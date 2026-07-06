from flask import Flask, render_template, request, jsonify
import pandas as pd
import numpy as np
import joblib
import os
from database import save_prediction, get_all_predictions, clear_all_predictions

app = Flask(__name__)

BASE_DIR = os.path.dirname(__file__)

# ─── Load model artefacts ───────────────────────────────────────────────────
def load_artefacts():
    model_path = os.path.join(BASE_DIR, 'heart_model.pkl')
    scaler_path = os.path.join(BASE_DIR, 'scaler.pkl')
    info_path   = os.path.join(BASE_DIR, 'model_info.pkl')

    if os.path.exists(model_path) and os.path.exists(scaler_path):
        model  = joblib.load(model_path)
        scaler = joblib.load(scaler_path)
        info   = joblib.load(info_path) if os.path.exists(info_path) else {}
        print(f"Model loaded: {info.get('model_name', 'Unknown')} "
              f"({info.get('accuracy', '?')}% accuracy)")
        return model, scaler, info
    print("Warning: Model files not found. Run model.py first.")
    return None, None, {}

model, scaler, model_info = load_artefacts()

FEATURE_ORDER = ['age', 'sex', 'cp', 'trestbps', 'chol', 'fbs', 'thalach', 'exang']

# ─── Static doctor directory (Pakistan: Peshawar, Islamabad, Rawalpindi) ───
DOCTORS = [
    {
        "id": 1,
        "name": "Prof. Dr. Adnan Mahmood Gul",
        "specialty": "Interventional Cardiology",
        "clinic": "Peshawar Institute of Cardiology (PIC)",
        "address": "Phase 5 Hayatabad, Peshawar, Khyber Pakhtunkhwa, Pakistan",
        "phone": "+92 (91) 9219600",
        "rating": 4.9,
        "reviews": 248,
        "available": True,
        "lat": 33.9961, "lng": 71.4631,
        "map_query": "Peshawar+Institute+of+Cardiology+Peshawar"
    },
    {
        "id": 2,
        "name": "Dr. Amber Ashraf",
        "specialty": "Preventive & Clinical Cardiology",
        "clinic": "Rehman Medical Institute (RMI)",
        "address": "5/B-2, Phase-V, Hayatabad, Peshawar, Pakistan",
        "phone": "+92 (91) 5838000",
        "rating": 4.8,
        "reviews": 115,
        "available": True,
        "lat": 33.9930, "lng": 71.4552,
        "map_query": "Rehman+Medical+Institute+Peshawar"
    },
    {
        "id": 3,
        "name": "Prof. Dr. Mohammad Hafizullah",
        "specialty": "Consultant Cardiologist",
        "clinic": "Lady Reading Hospital (LRH) / PIC",
        "address": "Pipal Mandi, Peshawar City, Peshawar, Pakistan",
        "phone": "+92 (91) 9211430",
        "rating": 4.9,
        "reviews": 389,
        "available": False,
        "lat": 34.0118, "lng": 71.5794,
        "map_query": "Lady+Reading+Hospital+Peshawar"
    },
    {
        "id": 4,
        "name": "Dr. Asad Akbar Khan",
        "specialty": "Cardiac Surgery",
        "clinic": "Northwest General Hospital & Research Center",
        "address": "Sector A-3, Phase-V, Hayatabad, Peshawar, Pakistan",
        "phone": "+92 (91) 5822600",
        "rating": 4.7,
        "reviews": 164,
        "available": True,
        "lat": 33.9995, "lng": 71.4560,
        "map_query": "Northwest+General+Hospital+Peshawar"
    },
    {
        "id": 5,
        "name": "Dr. Naeem Tareen",
        "specialty": "Interventional Cardiology",
        "clinic": "Quaid-e-Azam International Hospital",
        "address": "Near Peshawar Road, H-13, Islamabad, Pakistan",
        "phone": "+92 (51) 8447000",
        "rating": 4.9,
        "reviews": 512,
        "available": True,
        "lat": 33.6331, "lng": 72.9366,
        "map_query": "Quaid+e+Azam+International+Hospital+Islamabad"
    },
    {
        "id": 6,
        "name": "Dr. Khalid Iqbal",
        "specialty": "Consultant Cardiologist",
        "clinic": "Shifa International Hospital",
        "address": "Pitras Bukhari Road, H-8/4, Islamabad, Pakistan",
        "phone": "+92 (51) 8463000",
        "rating": 4.8,
        "reviews": 298,
        "available": True,
        "lat": 33.6896, "lng": 73.0763,
        "map_query": "Shifa+International+Hospital+Islamabad"
    },
    {
        "id": 7,
        "name": "Prof. Dr. Shahbaz A. Kureshi",
        "specialty": "Electrophysiology & Preventive Care",
        "clinic": "Islamabad Specialists Clinic",
        "address": "F-8 Markaz, Islamabad, Pakistan",
        "phone": "+92 (300) 5551234",
        "rating": 4.8,
        "reviews": 182,
        "available": True,
        "lat": 33.7122, "lng": 73.0487,
        "map_query": "Islamabad+Specialists+Clinic+F-8+Islamabad"
    },
    {
        "id": 8,
        "name": "Dr. Muhammad Asad",
        "specialty": "Heart Failure & Diagnostic Imaging",
        "clinic": "Pakistan Institute of Medical Sciences (PIMS)",
        "address": "G-8/3, Islamabad, Pakistan",
        "phone": "+92 (51) 9261170",
        "rating": 4.6,
        "reviews": 210,
        "available": False,
        "lat": 33.7032, "lng": 73.0560,
        "map_query": "Pakistan+Institute+of+Medical+Sciences+Islamabad"
    }
]

# ─── Routes ─────────────────────────────────────────────────────────────────

@app.route('/')
def home():
    return render_template('index.html')


@app.route('/predict', methods=['POST'])
def predict():
    if model is None or scaler is None:
        return jsonify({'error': 'Model not loaded. Run model.py first.'}), 500

    try:
        data = request.json
        patient_name = data.get('patient_name', 'Anonymous')
        diet_type = data.get('diet_type', 'Standard')

        features = {k: (float(data[k]) if k in ['age', 'trestbps', 'chol', 'thalach']
                        else int(data[k]))
                    for k in FEATURE_ORDER}

        df = pd.DataFrame([features])
        scaled = scaler.transform(df)

        prob       = float(model.predict_proba(scaled)[0][1])
        prediction = int(model.predict(scaled)[0])
        risk_pct   = round(prob * 100, 1)

        if prediction == 1:
            risk_label = "High Risk"
            risk_color = "#f43f5e"
            risk_bg    = "rgba(244, 63, 94, 0.15)"
        else:
            risk_label = "Low Risk"
            risk_color = "#10b981"
            risk_bg    = "rgba(16, 185, 129, 0.15)"

        # Feature importances for XAI
        fi = model_info.get('feature_importances', {})
        # Normalise so they sum to 1 (in case of rounding)
        total = sum(fi.values()) or 1
        fi_normalised = {k: round(v / total, 4) for k, v in fi.items()}

        result = {
            'prediction':          prediction,
            'probability':         risk_pct,
            'label':               risk_label,
            'color':               risk_color,
            'background':          risk_bg,
            'feature_importances': fi_normalised,
            'model_name':          model_info.get('model_name', 'ML Model'),
            'model_accuracy':      model_info.get('accuracy', 'N/A'),
            'all_accuracies':      model_info.get('all_accuracies', {}),
            'patient_name':        patient_name,
            'diet_type':           diet_type
        }

        # Auto-save to history DB (with name and diet type included)
        try:
            db_inputs = features.copy()
            db_inputs['patient_name'] = patient_name
            db_inputs['diet_type'] = diet_type
            save_prediction(db_inputs, result, model_info.get('model_name', 'Unknown'))
        except Exception as db_err:
            print(f"DB save warning: {db_err}")

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/history', methods=['GET'])
def history():
    try:
        rows = get_all_predictions(limit=50)
        return jsonify(rows)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/history/clear', methods=['POST'])
def clear_history():
    try:
        clear_all_predictions()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/doctors', methods=['GET'])
def doctors():
    return jsonify(DOCTORS)


@app.route('/model-info', methods=['GET'])
def get_model_info():
    return jsonify({
        'model_name':     model_info.get('model_name', 'Unknown'),
        'accuracy':       model_info.get('accuracy', 'N/A'),
        'all_accuracies': model_info.get('all_accuracies', {}),
        'feature_names':  model_info.get('feature_names', FEATURE_ORDER),
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
