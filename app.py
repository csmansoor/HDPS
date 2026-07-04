from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import joblib
import os
app = Flask(__name__)

# Load model and scaler
model_path = os.path.join(os.path.dirname(__file__), 'heart_model.pkl')
scaler_path = os.path.join(os.path.dirname(__file__), 'scaler.pkl')

if os.path.exists(model_path) and os.path.exists(scaler_path):
    model = joblib.load(model_path)
    scaler = joblib.load(scaler_path)
    print("Model and Scaler loaded successfully!")
else:
    model = None
    scaler = None
    print("Warning: Model or Scaler file not found. Please run model.py first.")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if model is None or scaler is None:
        return jsonify({'error': 'Model or Scaler not loaded on server.'}), 500
    
    try:
        data = request.json
        
        # Extract features in the exact order as trained:
        # ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'thalach', 'exang']
        features = {
            'age': float(data.get('age')),
            'sex': int(data.get('sex')),
            'cp': int(data.get('cp')),
            'trestbps': float(data.get('trestbps')),
            'chol': float(data.get('chol')),
            'fbs': int(data.get('fbs')),
            'thalach': float(data.get('thalach')),
            'exang': int(data.get('exang'))
        }
        
        # Convert to DataFrame
        df = pd.DataFrame([features])
        
        # Scale features
        scaled_features = scaler.transform(df)
        
        # Predict probability and class
        # For Logistic Regression, predict_proba returns probabilities for [class 0, class 1]
        prob = model.predict_proba(scaled_features)[0][1]
        prediction = int(model.predict(scaled_features)[0])
        
        # Define risk level and visual feedback details
        risk_percentage = round(prob * 100, 1)
        
        if prediction == 1:
            risk_label = "High Risk"
            risk_color = "#f43f5e" # sleek red/rose
            risk_bg = "rgba(244, 63, 94, 0.15)"
        else:
            risk_label = "Low Risk"
            risk_color = "#10b981" # sleek emerald
            risk_bg = "rgba(16, 185, 129, 0.15)"
            
        return jsonify({
            'prediction': prediction,
            'probability': risk_percentage,
            'label': risk_label,
            'color': risk_color,
            'background': risk_bg
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 400

if __name__ == '__main__':
    # Start flask app
    app.run(debug=True, host='127.0.0.1', port=5000)
