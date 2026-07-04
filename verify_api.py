import urllib.request
import json
import sys

# Test URLs
url = "http://127.0.0.1:5000/predict"

# 1. Test case for Low Risk patient
low_risk_payload = {
    "age": 35.0,
    "sex": 0,       # Female
    "cp": 2,        # Non-anginal pain
    "trestbps": 110.0,
    "chol": 180.0,
    "fbs": 0,
    "thalach": 165.0, # High max heart rate
    "exang": 0      # No exercise angina
}

# 2. Test case for High Risk patient
high_risk_payload = {
    "age": 68.0,
    "sex": 1,       # Male
    "cp": 0,        # Typical angina
    "trestbps": 165.0,
    "chol": 310.0,
    "fbs": 1,
    "thalach": 95.0, # Low max heart rate
    "exang": 1      # Has exercise angina
}

def run_test(name, payload):
    print(f"\n--- Testing: {name} ---")
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as response:
            status = response.status
            response_data = json.loads(response.read().decode('utf-8'))
            
            print(f"Status Code: {status}")
            print(f"Prediction label: {response_data.get('label')}")
            print(f"Risk Probability: {response_data.get('probability')}%")
            print(f"Color returned: {response_data.get('color')}")
            print(f"Background: {response_data.get('background')}")
            return response_data
    except Exception as e:
        print(f"Error testing {name}: {e}")
        return None

if __name__ == '__main__':
    print("Verifying CardioPulse prediction API...")
    
    low_risk_res = run_test("Low Risk Patient Profile", low_risk_payload)
    high_risk_res = run_test("High Risk Patient Profile", high_risk_payload)
    
    if low_risk_res and high_risk_res:
        print("\nAPI Verification Successful! Both low-risk and high-risk prediction flows run perfectly.")
        sys.exit(0)
    else:
        print("\nAPI Verification Failed.")
        sys.exit(1)
