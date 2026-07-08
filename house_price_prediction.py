# ============================================================================
# 🏠 HOUSE PRICE PREDICTION — REGRESSION MICROPROJECT
# ============================================================================
# Course  : SAKEC Third Year B.Tech Computer Engineering — Machine Learning
# COs     : CO1 (Data Preprocessing), CO2 (Regression Algorithms), CO5 (Evaluation)
# Tools   : Scikit-Learn, Pandas, XGBoost, Seaborn, Matplotlib
# Platform: Google Colab
# ============================================================================

# ──────────────────────────────────────────────────────────────────────────────
# SECTION 0 — INSTALL DEPENDENCIES (run once in Colab)
# ──────────────────────────────────────────────────────────────────────────────
# !pip install xgboost scikit-learn pandas seaborn matplotlib --quiet

import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

try:
    from xgboost import XGBRegressor
except ImportError:
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "xgboost", "-q"])
    from xgboost import XGBRegressor

print("✅ All libraries imported successfully.\n")


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║ SECTION 1 — CONFIGURATION (easily add/remove columns here)                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# ── Target Variable ──
TARGET = "total_amount"

# ── Numerical Features ──
# Add or remove feature names as needed; the pipeline adapts automatically.
NUMERICAL_FEATURES = [
    "carpet_area_sqft",
    "super_area_sqft",
    "bathroom_count",
    "balcony_count",
    "floor_number",            # ← additional useful numeric feature
    "total_floors",            # ← additional useful numeric feature
    "age_of_property_years",   # ← additional useful numeric feature
]

# ── Categorical Features ──
CATEGORICAL_FEATURES = [
    "property_status",     # Ready to Move / Under Construction
    "transaction_type",    # New Property / Resale
    "furnishing",          # Furnished / Semi-Furnished / Unfurnished
    "facing",              # East / West / North / South / NE / NW / SE / SW
    "ownership_type",      # Freehold / Leasehold / Co-operative Society
    "location",            # ← city locality (high-cardinality, handled below)
    "property_type",       # ← Apartment / Villa / Independent House / Penthouse / Studio
    "bhk_type",            # ← 1 BHK / 2 BHK / 3 BHK / 4+ BHK
]

# ── Train/Test Split ──
TEST_SIZE   = 0.20
RANDOM_SEED = 42

print("📋 Configuration loaded.")
print(f"   Numerical features  : {len(NUMERICAL_FEATURES)}")
print(f"   Categorical features: {len(CATEGORICAL_FEATURES)}")
print(f"   Target variable     : {TARGET}\n")


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║ SECTION 2 — SYNTHETIC DATASET GENERATION                                  ║
# ║ (Replace this section with pd.read_csv("your_data.csv") for real data)    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def generate_synthetic_dataset(n_samples: int = 5000, seed: int = RANDOM_SEED) -> pd.DataFrame:
    """
    Generate a realistic synthetic housing dataset.
    Replace this function with `pd.read_csv(...)` when using real data.
    """
    rng = np.random.default_rng(seed)

    # ── Locations with base price multipliers (₹ per sqft) ──
    locations = {
        "Andheri West": 18000, "Bandra West": 35000, "Powai": 20000,
        "Thane West": 10000, "Navi Mumbai": 8500, "Worli": 40000,
        "Goregaon East": 14000, "Kandivali West": 12000, "Borivali East": 11000,
        "Chembur": 15000, "Dadar West": 25000, "Malad West": 13000,
        "Juhu": 38000, "Vashi": 9500, "Kharghar": 7500,
    }
    loc_names = list(locations.keys())
    loc_prices = np.array(list(locations.values()))

    # ── Property types with area ranges ──
    property_types = ["Apartment", "Villa", "Independent House", "Penthouse", "Studio"]
    bhk_types      = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK"]

    # Sample locations
    loc_idx = rng.integers(0, len(loc_names), size=n_samples)
    chosen_locations   = [loc_names[i] for i in loc_idx]
    chosen_base_prices = loc_prices[loc_idx].astype(float)

    # Sample property & BHK types
    chosen_property_type = rng.choice(property_types, size=n_samples, p=[0.50, 0.12, 0.18, 0.05, 0.15])
    chosen_bhk           = rng.choice(bhk_types, size=n_samples, p=[0.20, 0.35, 0.25, 0.12, 0.08])

    # Areas based on BHK
    bhk_area_map = {"1 BHK": (350, 600), "2 BHK": (600, 1000), "3 BHK": (1000, 1600),
                    "4 BHK": (1600, 2500), "5 BHK": (2500, 4000)}
    carpet_areas = np.array([rng.integers(*bhk_area_map[b]) for b in chosen_bhk], dtype=float)
    super_areas  = carpet_areas * rng.uniform(1.15, 1.35, size=n_samples)

    # Other numeric features
    bathroom_counts = np.array([max(1, int(b[0]) + rng.integers(-1, 2)) for b in chosen_bhk])
    balcony_counts  = rng.integers(0, 4, size=n_samples)
    floor_numbers   = rng.integers(0, 40, size=n_samples)
    total_floors    = floor_numbers + rng.integers(1, 20, size=n_samples)
    age_of_property = rng.exponential(scale=5, size=n_samples).round(1)

    # Categorical features
    property_statuses  = rng.choice(["Ready to Move", "Under Construction"], size=n_samples, p=[0.65, 0.35])
    transaction_types  = rng.choice(["New Property", "Resale"], size=n_samples, p=[0.40, 0.60])
    furnishings        = rng.choice(["Furnished", "Semi-Furnished", "Unfurnished"], size=n_samples, p=[0.25, 0.40, 0.35])
    facings            = rng.choice(["East", "West", "North", "South", "North-East", "South-West"], size=n_samples)
    ownership_types    = rng.choice(["Freehold", "Leasehold", "Co-operative Society"], size=n_samples, p=[0.55, 0.25, 0.20])

    # ── Price calculation (realistic formula with noise) ──
    furnishing_mult = np.where(furnishings == "Furnished", 1.15,
                      np.where(furnishings == "Semi-Furnished", 1.05, 1.0))
    status_mult     = np.where(property_statuses == "Under Construction", 0.90, 1.0)
    age_decay       = np.clip(1.0 - age_of_property * 0.008, 0.85, 1.0)

    total_amount = (
        chosen_base_prices * super_areas       # base price × area
        * furnishing_mult                      # furnishing premium
        * status_mult                          # under-construction discount
        * age_decay                            # age depreciation
        * rng.uniform(0.90, 1.10, n_samples)  # market noise ±10%
    )
    total_amount = np.round(total_amount, -3)  # round to nearest thousand

    # ── Build DataFrame ──
    df = pd.DataFrame({
        "carpet_area_sqft"     : carpet_areas,
        "super_area_sqft"      : super_areas.round(1),
        "bathroom_count"       : bathroom_counts,
        "balcony_count"        : balcony_counts,
        "floor_number"         : floor_numbers,
        "total_floors"         : total_floors,
        "age_of_property_years": age_of_property,
        "property_status"      : property_statuses,
        "transaction_type"     : transaction_types,
        "furnishing"           : furnishings,
        "facing"               : facings,
        "ownership_type"       : ownership_types,
        "location"             : chosen_locations,
        "property_type"        : chosen_property_type,
        "bhk_type"             : chosen_bhk,
        TARGET                 : total_amount,
    })

    # Inject ~5 % missing values for preprocessing practice (CO1)
    for col in ["carpet_area_sqft", "bathroom_count", "furnishing", "facing", "age_of_property_years"]:
        mask = rng.random(n_samples) < 0.05
        df.loc[mask, col] = np.nan

    return df


# ── Load Data ──
# 💡 TO USE YOUR OWN CSV, REPLACE THE LINE BELOW:
# df = pd.read_csv("/content/house_prices.csv")
df = generate_synthetic_dataset(n_samples=5000)

print(f"📊 Dataset shape: {df.shape}")
print(f"   Columns: {list(df.columns)}\n")
df.head()


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║ SECTION 3 — EXPLORATORY DATA ANALYSIS (EDA)                               ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def run_eda(df: pd.DataFrame) -> None:
    """Quick EDA: summary stats, missing values, distribution plots."""

    print("=" * 60)
    print("  EXPLORATORY DATA ANALYSIS")
    print("=" * 60)

    # 3.1 — Info & Missing Values
    print("\n📌 Missing Values:")
    missing = df.isnull().sum()
    print(missing[missing > 0].to_string())

    print(f"\n📌 Dataset Statistics (numeric):")
    print(df.describe().round(2).to_string())

    # 3.2 — Target Distribution
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    sns.histplot(df[TARGET], bins=50, kde=True, color="#4361ee", ax=axes[0])
    axes[0].set_title("Distribution of House Prices", fontsize=14, fontweight="bold")
    axes[0].set_xlabel("Total Amount (₹)")

    sns.histplot(np.log1p(df[TARGET]), bins=50, kde=True, color="#f72585", ax=axes[1])
    axes[1].set_title("Log-Transformed Price Distribution", fontsize=14, fontweight="bold")
    axes[1].set_xlabel("log(1 + Total Amount)")

    plt.tight_layout()
    plt.show()

    # 3.3 — Correlation Heatmap (numeric features)
    numeric_cols = df[NUMERICAL_FEATURES + [TARGET]].select_dtypes(include=np.number)
    plt.figure(figsize=(10, 7))
    sns.heatmap(numeric_cols.corr(), annot=True, fmt=".2f", cmap="coolwarm",
                square=True, linewidths=0.5)
    plt.title("Correlation Heatmap — Numerical Features", fontsize=14, fontweight="bold")
    plt.tight_layout()
    plt.show()

    # 3.4 — Boxplot: Price by Property Type
    plt.figure(figsize=(12, 5))
    order = df.groupby("property_type")[TARGET].median().sort_values(ascending=False).index
    sns.boxplot(data=df, x="property_type", y=TARGET, order=order, palette="viridis")
    plt.title("House Price by Property Type", fontsize=14, fontweight="bold")
    plt.ylabel("Total Amount (₹)")
    plt.xlabel("Property Type")
    plt.tight_layout()
    plt.show()

    # 3.5 — Boxplot: Price by BHK Type
    plt.figure(figsize=(10, 5))
    sns.boxplot(data=df, x="bhk_type", y=TARGET,
                order=["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK"], palette="magma")
    plt.title("House Price by BHK Type", fontsize=14, fontweight="bold")
    plt.ylabel("Total Amount (₹)")
    plt.tight_layout()
    plt.show()

    # 3.6 — Top 10 Locations by Median Price
    plt.figure(figsize=(12, 5))
    top_loc = df.groupby("location")[TARGET].median().sort_values(ascending=False).head(10)
    sns.barplot(x=top_loc.values, y=top_loc.index, palette="rocket")
    plt.title("Top 10 Locations by Median Price", fontsize=14, fontweight="bold")
    plt.xlabel("Median Total Amount (₹)")
    plt.tight_layout()
    plt.show()

run_eda(df)


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║ SECTION 4 — DATA PREPROCESSING (CO1 — ColumnTransformer + Pipeline)       ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# ── 4.1  Filter features that actually exist in the DataFrame ──
available_num = [f for f in NUMERICAL_FEATURES if f in df.columns]
available_cat = [f for f in CATEGORICAL_FEATURES if f in df.columns]

print(f"✅ Using {len(available_num)} numerical features : {available_num}")
print(f"✅ Using {len(available_cat)} categorical features: {available_cat}\n")

# ── 4.2  Separate features (X) and target (y) ──
X = df[available_num + available_cat]
y = df[TARGET]

# ── 4.3  Train / Test Split ──
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=TEST_SIZE, random_state=RANDOM_SEED
)
print(f"🔀 Train set: {X_train.shape[0]} samples | Test set: {X_test.shape[0]} samples\n")

# ── 4.4  Build Preprocessing Pipelines ──

# Numeric pipeline: Impute (median) → Scale (StandardScaler)
numeric_pipeline = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="median")),
    ("scaler",  StandardScaler()),
])

# Categorical pipeline: Impute (most_frequent / mode) → One-Hot Encode
categorical_pipeline = Pipeline(steps=[
    ("imputer", SimpleImputer(strategy="most_frequent")),
    ("onehot",  OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
])

# ColumnTransformer: apply each pipeline to its respective columns
preprocessor = ColumnTransformer(transformers=[
    ("num", numeric_pipeline,      available_num),
    ("cat", categorical_pipeline,  available_cat),
])

print("🔧 Preprocessing pipeline built:")
print("   Numeric  → SimpleImputer(median) → StandardScaler")
print("   Category → SimpleImputer(mode)   → OneHotEncoder\n")


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║ SECTION 5 — MODEL TRAINING (CO2 — Modules 1 & 2)                          ║
# ║ Algorithms: Linear Regression, Decision Tree, Random Forest, XGBoost      ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# ── 5.1  Define Models ──
models = {
    "Multiple Linear Regression": LinearRegression(),
    "Decision Tree (CART)"      : DecisionTreeRegressor(max_depth=12, min_samples_split=10,
                                                        random_state=RANDOM_SEED),
    "Random Forest"             : RandomForestRegressor(n_estimators=200, max_depth=15,
                                                        min_samples_split=5,
                                                        random_state=RANDOM_SEED, n_jobs=-1),
    "XGBoost"                   : XGBRegressor(n_estimators=300, max_depth=8,
                                               learning_rate=0.08, subsample=0.8,
                                               colsample_bytree=0.8,
                                               random_state=RANDOM_SEED, verbosity=0),
}

# ── 5.2  Train & Evaluate Each Model ──
results = []

for name, model in models.items():
    print(f"⏳ Training: {name} ...")

    # Full pipeline: Preprocessor → Model
    pipe = Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("regressor",    model),
    ])

    # Fit
    pipe.fit(X_train, y_train)

    # Predict
    y_pred = pipe.predict(X_test)

    # Evaluate (CO5 — Section 2.2 metrics)
    mae  = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2   = r2_score(y_test, y_pred)

    # Cross-validation R² (5-fold)
    cv_scores = cross_val_score(pipe, X_train, y_train, cv=5, scoring="r2", n_jobs=-1)
    cv_r2     = cv_scores.mean()

    results.append({
        "Model"        : name,
        "MAE (₹)"      : round(mae, 2),
        "RMSE (₹)"     : round(rmse, 2),
        "R² Score"     : round(r2, 4),
        "CV R² (5-fold)": round(cv_r2, 4),
        "_pipeline"    : pipe,       # store for later use
        "_y_pred"      : y_pred,
    })

    print(f"   ✅ MAE = ₹{mae:,.0f} | RMSE = ₹{rmse:,.0f} | R² = {r2:.4f} | CV R² = {cv_r2:.4f}\n")


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║ SECTION 6 — EVALUATION & COMPARISON (CO5)                                 ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

# ── 6.1  Comparison DataFrame ──
comparison_df = pd.DataFrame(results).drop(columns=["_pipeline", "_y_pred"])

print("=" * 70)
print("  📊 MODEL COMPARISON TABLE")
print("=" * 70)
print(comparison_df.to_string(index=False))
print()

# ── 6.2  Identify Best Model ──
best_idx   = comparison_df["R² Score"].idxmax()
best_name  = comparison_df.loc[best_idx, "Model"]
best_r2    = comparison_df.loc[best_idx, "R² Score"]
best_pipe  = results[best_idx]["_pipeline"]
best_preds = results[best_idx]["_y_pred"]

print(f"🏆 Best Model: {best_name}  (R² = {best_r2:.4f})")
print(f"   ➤ Recommendation: Use '{best_name}' for deployment.\n")

# ── 6.3  Bar Chart — R² Comparison ──
plt.figure(figsize=(10, 5))
colors = ["#4361ee", "#3a0ca3", "#7209b7", "#f72585"]
bars = plt.barh(comparison_df["Model"], comparison_df["R² Score"], color=colors, edgecolor="white")
for bar, val in zip(bars, comparison_df["R² Score"]):
    plt.text(bar.get_width() + 0.005, bar.get_y() + bar.get_height() / 2,
             f"{val:.4f}", va="center", fontweight="bold", fontsize=11)
plt.xlabel("R² Score", fontsize=12)
plt.title("Model Comparison — R² Score", fontsize=14, fontweight="bold")
plt.xlim(0, 1.05)
plt.tight_layout()
plt.show()

# ── 6.4  Bar Chart — MAE & RMSE ──
fig, ax = plt.subplots(figsize=(10, 5))
x = np.arange(len(comparison_df))
width = 0.35
ax.bar(x - width / 2, comparison_df["MAE (₹)"],  width, label="MAE",  color="#4cc9f0")
ax.bar(x + width / 2, comparison_df["RMSE (₹)"], width, label="RMSE", color="#f72585")
ax.set_xticks(x)
ax.set_xticklabels(comparison_df["Model"], rotation=15, ha="right")
ax.set_ylabel("Error (₹)")
ax.set_title("MAE & RMSE Comparison Across Models", fontsize=14, fontweight="bold")
ax.legend()
plt.tight_layout()
plt.show()


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║ SECTION 7 — VISUALIZATION: ACTUAL vs PREDICTED (Best Model)               ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def plot_actual_vs_predicted(y_true, y_pred, model_name: str) -> None:
    """Scatter plot of Actual vs Predicted prices with perfect-prediction line."""

    plt.figure(figsize=(10, 8))

    sns.scatterplot(x=y_true, y=y_pred, alpha=0.4, s=30, color="#4361ee",
                    edgecolor="white", linewidth=0.3)

    # Perfect prediction line
    max_val = max(y_true.max(), y_pred.max())
    min_val = min(y_true.min(), y_pred.min())
    plt.plot([min_val, max_val], [min_val, max_val], "r--", linewidth=2, label="Perfect Prediction")

    # Metrics annotation
    r2   = r2_score(y_true, y_pred)
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    textstr = f"R² = {r2:.4f}\nMAE = ₹{mae:,.0f}\nRMSE = ₹{rmse:,.0f}"
    plt.text(0.05, 0.92, textstr, transform=plt.gca().transAxes,
             fontsize=12, verticalalignment="top",
             bbox=dict(boxstyle="round,pad=0.4", facecolor="wheat", alpha=0.7))

    plt.xlabel("Actual Price (₹)", fontsize=13)
    plt.ylabel("Predicted Price (₹)", fontsize=13)
    plt.title(f"Actual vs Predicted House Prices — {model_name}",
              fontsize=15, fontweight="bold")
    plt.legend(fontsize=12)
    plt.tight_layout()
    plt.show()


plot_actual_vs_predicted(y_test.values, best_preds, best_name)


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║ SECTION 8 — RESIDUAL ANALYSIS (Bonus for Report)                          ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def plot_residuals(y_true, y_pred, model_name: str) -> None:
    """Residual distribution and residual-vs-predicted plots."""
    residuals = y_true - y_pred

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))

    # Residual histogram
    sns.histplot(residuals, bins=50, kde=True, color="#7209b7", ax=axes[0])
    axes[0].axvline(0, color="red", linestyle="--", linewidth=1.5)
    axes[0].set_title(f"Residual Distribution — {model_name}", fontsize=13, fontweight="bold")
    axes[0].set_xlabel("Residual (Actual − Predicted)")

    # Residual vs Predicted
    sns.scatterplot(x=y_pred, y=residuals, alpha=0.35, s=20, color="#3a0ca3", ax=axes[1])
    axes[1].axhline(0, color="red", linestyle="--", linewidth=1.5)
    axes[1].set_title(f"Residuals vs Predicted — {model_name}", fontsize=13, fontweight="bold")
    axes[1].set_xlabel("Predicted Price (₹)")
    axes[1].set_ylabel("Residual (₹)")

    plt.tight_layout()
    plt.show()


plot_residuals(y_test.values, best_preds, best_name)


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║ SECTION 9 — FEATURE IMPORTANCE (Best Tree-Based Model)                    ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def plot_feature_importance(pipeline, model_name: str, top_n: int = 20) -> None:
    """Extract and plot feature importances from tree-based models in a Pipeline."""
    regressor = pipeline.named_steps["regressor"]

    if not hasattr(regressor, "feature_importances_"):
        print(f"⚠️  {model_name} does not support feature_importances_. Skipping.")
        return

    # Get feature names from the preprocessor
    preprocessor_step = pipeline.named_steps["preprocessor"]
    try:
        feature_names = preprocessor_step.get_feature_names_out()
    except AttributeError:
        feature_names = [f"feature_{i}" for i in range(len(regressor.feature_importances_))]

    # Clean up feature names (remove prefixes like "num__" or "cat__")
    feature_names = [name.split("__", 1)[-1] if "__" in name else name for name in feature_names]

    importances = regressor.feature_importances_
    feat_imp = pd.Series(importances, index=feature_names).sort_values(ascending=False).head(top_n)

    plt.figure(figsize=(10, 7))
    sns.barplot(x=feat_imp.values, y=feat_imp.index, palette="viridis")
    plt.title(f"Top {top_n} Feature Importances — {model_name}", fontsize=14, fontweight="bold")
    plt.xlabel("Importance")
    plt.tight_layout()
    plt.show()


# Plot for best model (if tree-based), otherwise for Random Forest
if hasattr(best_pipe.named_steps["regressor"], "feature_importances_"):
    plot_feature_importance(best_pipe, best_name)
else:
    # Fall back to Random Forest
    rf_result = [r for r in results if "Random Forest" in r["Model"]][0]
    plot_feature_importance(rf_result["_pipeline"], rf_result["Model"])


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║ SECTION 10 — PREDICTION DEMO (Interactive)                                ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

def predict_price(pipeline, sample: dict) -> float:
    """Predict house price for a single sample using the trained pipeline."""
    sample_df = pd.DataFrame([sample])
    prediction = pipeline.predict(sample_df)[0]
    return prediction


# Example: predict price for a specific house
sample_house = {
    "carpet_area_sqft"     : 1200,
    "super_area_sqft"      : 1500,
    "bathroom_count"       : 2,
    "balcony_count"        : 1,
    "floor_number"         : 8,
    "total_floors"         : 20,
    "age_of_property_years": 3.0,
    "property_status"      : "Ready to Move",
    "transaction_type"     : "Resale",
    "furnishing"           : "Semi-Furnished",
    "facing"               : "East",
    "ownership_type"       : "Freehold",
    "location"             : "Andheri West",
    "property_type"        : "Apartment",
    "bhk_type"             : "3 BHK",
}

predicted_price = predict_price(best_pipe, sample_house)

print("=" * 60)
print("  🏠 SAMPLE PREDICTION")
print("=" * 60)
for k, v in sample_house.items():
    print(f"   {k:25s}: {v}")
print(f"\n   💰 Predicted Price: ₹{predicted_price:,.0f}")
print(f"   🤖 Model Used    : {best_name}")
print("=" * 60)


# ╔══════════════════════════════════════════════════════════════════════════════╗
# ║ SECTION 11 — FINAL SUMMARY & RECOMMENDATIONS                              ║
# ╚══════════════════════════════════════════════════════════════════════════════╝

print("""
╔══════════════════════════════════════════════════════════════════════════╗
║                    📋 PROJECT SUMMARY & RECOMMENDATIONS                ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                        ║
║  CO1 — Data Preprocessing:                                             ║
║    ✅ Missing value imputation (median for numeric, mode for category) ║
║    ✅ StandardScaler for numerical features                            ║
║    ✅ OneHotEncoder for categorical features                           ║
║    ✅ ColumnTransformer + Pipeline architecture                        ║
║                                                                        ║
║  CO2 — Regression Algorithms:                                          ║
║    ✅ Multiple Linear Regression                                       ║
║    ✅ Decision Tree Regressor (CART framework)                         ║
║    ✅ Random Forest Regressor (Bagging ensemble)                       ║
║    ✅ XGBoost Regressor (Gradient Boosting ensemble)                   ║
║                                                                        ║
║  CO5 — Model Evaluation:                                               ║
║    ✅ Mean Absolute Error (MAE)                                        ║
║    ✅ Root Mean Squared Error (RMSE)                                   ║
║    ✅ R-squared (R²) Score                                             ║
║    ✅ 5-Fold Cross-Validation R²                                       ║
║    ✅ Model comparison table                                           ║
║                                                                        ║
║  Additional Features:                                                  ║
║    ✅ Location feature (15 Mumbai localities with price tiers)         ║
║    ✅ Property types (Apartment, Villa, Independent House, etc.)       ║
║    ✅ BHK types (1–5 BHK)                                             ║
║    ✅ Feature importance visualization                                 ║
║    ✅ Residual analysis                                                ║
║    ✅ Actual vs Predicted scatter plot                                 ║
║    ✅ Interactive single-sample prediction demo                        ║
║                                                                        ║
║  🏆 Recommended Model for Deployment:                                  ║
""")
print(f"║    → {best_name} (R² = {best_r2:.4f})")
print("""║                                                                        ║
║  📌 Feature Recommendations for Real-World Improvement:                ║
║    • Add 'amenities_score' (gym, pool, parking, etc.)                  ║
║    • Add 'distance_to_metro_km' and 'distance_to_school_km'           ║
║    • Add 'crime_rate_index' for the locality                           ║
║    • Add 'year_built' instead of computed age                          ║
║    • Use Target Encoding for high-cardinality 'location' at scale      ║
║                                                                        ║
╚══════════════════════════════════════════════════════════════════════════╝
""")
