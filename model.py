import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib

# ==========================================
# 1. GENERATE DATASET (SIMULATING UCI DATA)
# ==========================================
print("Creating dataset...")
np.random.seed(42)
num_patients = 1000

# Generating realistic health data distributions
age      = np.random.randint(29, 80, size=num_patients)
sex      = np.random.choice([0, 1], size=num_patients, p=[0.32, 0.68])   # 1=male, 0=female
cp       = np.random.choice([0, 1, 2, 3], size=num_patients, p=[0.48, 0.16, 0.28, 0.08])
trestbps = np.random.randint(94, 200, size=num_patients)
chol     = np.random.randint(126, 564, size=num_patients)
fbs      = np.random.choice([0, 1], size=num_patients, p=[0.85, 0.15])
thalach  = np.random.randint(71, 202, size=num_patients)
exang    = np.random.choice([0, 1], size=num_patients, p=[0.67, 0.33])

# Assign risk labels logically (higher age, BP, cholesterol, chest pain → higher risk)
risk_score = (age * 0.03) + (cp * 0.4) + (trestbps * 0.01) + (chol * 0.005) - (thalach * 0.02) + (exang * 0.5)
risk_prob  = 1 / (1 + np.exp(-risk_score))
target     = (risk_prob > np.median(risk_prob)).astype(int)

FEATURE_NAMES = ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'thalach', 'exang']

df = pd.DataFrame({
    'age': age, 'sex': sex, 'cp': cp, 'trestbps': trestbps,
    'chol': chol, 'fbs': fbs, 'thalach': thalach, 'exang': exang,
    'target': target
})
df.to_csv("heart.csv", index=False)
print("Saved dataset to 'heart.csv'.")

# ==========================================
# 2. PREPROCESSING & SPLITTING
# ==========================================
X = df[FEATURE_NAMES]
y = df['target']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled  = scaler.transform(X_test)

# ==========================================
# 3. TRAINING & EVALUATING ALL 3 MODELS
# ==========================================

# Model A: Logistic Regression
print("\nTraining Logistic Regression...")
lr_model = LogisticRegression(random_state=42, max_iter=1000)
lr_model.fit(X_train_scaled, y_train)
lr_preds = lr_model.predict(X_test_scaled)
lr_acc   = accuracy_score(y_test, lr_preds)
print(f"  LR Accuracy: {lr_acc * 100:.2f}%")
print(classification_report(y_test, lr_preds))

# Model B: Random Forest
print("\nTraining Random Forest Classifier...")
rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
rf_model.fit(X_train_scaled, y_train)
rf_preds = rf_model.predict(X_test_scaled)
rf_acc   = accuracy_score(y_test, rf_preds)
print(f"  RF Accuracy: {rf_acc * 100:.2f}%")
print(classification_report(y_test, rf_preds))

# Model C: Support Vector Machine (with probability calibration)
print("\nTraining Support Vector Machine (SVM)...")
svm_model = SVC(kernel='rbf', probability=True, random_state=42, C=1.0, gamma='scale')
svm_model.fit(X_train_scaled, y_train)
svm_preds = svm_model.predict(X_test_scaled)
svm_acc   = accuracy_score(y_test, svm_preds)
print(f"  SVM Accuracy: {svm_acc * 100:.2f}%")
print(classification_report(y_test, svm_preds))

# ==========================================
# 4. CHOOSE BEST MODEL
# ==========================================
candidates = [
    ('Logistic Regression', lr_model, lr_acc),
    ('Random Forest',       rf_model, rf_acc),
    ('SVM',                 svm_model, svm_acc),
]
best_name, best_model, best_acc = max(candidates, key=lambda x: x[2])

print(f"\nModel Comparison:")
for name, _, acc in candidates:
    marker = " <- BEST" if name == best_name else ""
    print(f"  {name}: {acc * 100:.2f}%{marker}")

# ==========================================
# 5. COMPUTE FEATURE IMPORTANCES (XAI)
# ==========================================
if best_name == 'Random Forest':
    importances = best_model.feature_importances_.tolist()
elif best_name == 'Logistic Regression':
    # Use absolute coefficient values, normalised to sum=1
    coefs = np.abs(best_model.coef_[0])
    importances = (coefs / coefs.sum()).tolist()
else:
    # SVM: use absolute decision function weights via dual coef trick
    # Approximate via a fallback — train a quick RF for XAI only
    xai_rf = RandomForestClassifier(n_estimators=50, random_state=42)
    xai_rf.fit(X_train_scaled, y_train)
    importances = xai_rf.feature_importances_.tolist()

feature_importance_map = dict(zip(FEATURE_NAMES, importances))
print("\nFeature Importances (XAI):")
for feat, imp in sorted(feature_importance_map.items(), key=lambda x: -x[1]):
    print(f"  {feat}: {imp:.4f}")

# ==========================================
# 6. EXPORT ARTEFACTS
# ==========================================
joblib.dump(best_model, 'heart_model.pkl')
joblib.dump(scaler,     'scaler.pkl')
joblib.dump({
    'model_name':          best_name,
    'accuracy':            round(best_acc * 100, 2),
    'feature_names':       FEATURE_NAMES,
    'feature_importances': feature_importance_map,
    'all_accuracies': {
        'Logistic Regression': round(lr_acc * 100, 2),
        'Random Forest':       round(rf_acc * 100, 2),
        'SVM':                 round(svm_acc * 100, 2),
    }
}, 'model_info.pkl')

print(f"\nSaved: heart_model.pkl ({best_name}), scaler.pkl, model_info.pkl")