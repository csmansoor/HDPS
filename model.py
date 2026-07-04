import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib

# ==========================================
# 1. GENERATE DATASET (SIMULATING UCI DATA)
# ==========================================
print("Creating dataset...")
np.random.seed(42)
num_patients = 1000

# Generating realistic health data distributions
age = np.random.randint(29, 80, size=num_patients)
sex = np.random.choice([0, 1], size=num_patients, p=[0.32, 0.68]) # 1 = male, 0 = female
cp = np.random.choice([0, 1, 2, 3], size=num_patients, p=[0.48, 0.16, 0.28, 0.08]) # Chest pain type
trestbps = np.random.randint(94, 200, size=num_patients) # Blood pressure
chol = np.random.randint(126, 564, size=num_patients) # Cholesterol
fbs = np.random.choice([0, 1], size=num_patients, p=[0.85, 0.15]) # Fasting blood sugar
thalach = np.random.randint(71, 202, size=num_patients) # Max heart rate
exang = np.random.choice([0, 1], size=num_patients, p=[0.67, 0.33]) # Exercise angina

# Define an equation to assign risk labels logically based on weights
# Higher cholesterol, age, blood pressure, and chest pain increase target risk
risk_score = (age * 0.03) + (cp * 0.4) + (trestbps * 0.01) + (chol * 0.005) - (thalach * 0.02) + (exang * 0.5)
risk_prob = 1 / (1 + np.exp(-risk_score)) # sigmoid function
target = (risk_prob > np.median(risk_prob)).astype(int)

# Combine into a Pandas DataFrame
df = pd.DataFrame({
    'age': age, 'sex': sex, 'cp': cp, 'trestbps': trestbps, 
    'chol': chol, 'fbs': fbs, 'thalach': thalach, 'exang': exang, 
    'target': target
})

# Save a copy as a CSV file for reference
df.to_csv("heart.csv", index=False)
print("Saved dataset to 'heart.csv'.")

# ==========================================
# 2. PREPROCESSING & SPLITTING
# ==========================================
X = df.drop(columns=['target'])
y = df['target']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Scale continuous numerical features
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# ==========================================
# 3. TRAINING & EVALUATING MODELS
# ==========================================

# Model A: Logistic Regression (useful for probability calibration)
print("\nTraining Logistic Regression...")
lr_model = LogisticRegression(random_state=42)
lr_model.fit(X_train_scaled, y_train)

lr_preds = lr_model.predict(X_test_scaled)
lr_acc = accuracy_score(y_test, lr_preds)

print("--- Logistic Regression Report ---")
print(f"Accuracy: {lr_acc * 100:.2f}%")
print("Confusion Matrix:\n", confusion_matrix(y_test, lr_preds))
print("Classification Report:\n", classification_report(y_test, lr_preds))

# Model B: Random Forest Classifier (rule-based tree classification)
print("\nTraining Random Forest Classifier...")
rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
rf_model.fit(X_train_scaled, y_train)

rf_preds = rf_model.predict(X_test_scaled)
rf_acc = accuracy_score(y_test, rf_preds)

print("--- Random Forest Report ---")
print(f"Accuracy: {rf_acc * 100:.2f}%")
print("Confusion Matrix:\n", confusion_matrix(y_test, rf_preds))
print("Classification Report:\n", classification_report(y_test, rf_preds))

# ==========================================
# 4. CHOOSE BEST MODEL & EXPORT
# ==========================================
if lr_acc >= rf_acc:
    best_model = lr_model
    best_name = "Logistic Regression"
    best_acc = lr_acc
else:
    best_model = rf_model
    best_name = "Random Forest"
    best_acc = rf_acc

print(f"\nComparing Models: Logistic Regression ({lr_acc * 100:.2f}%) vs Random Forest ({rf_acc * 100:.2f}%)")
print(f"Best Performing Model: {best_name} ({best_acc * 100:.2f}%)")

# Save the highest-performing model and the scaler artifact
joblib.dump(best_model, 'heart_model.pkl')
joblib.dump(scaler, 'scaler.pkl')
print(f"Success: Saved best model ({best_name}) as 'heart_model.pkl' and scaler as 'scaler.pkl'!")