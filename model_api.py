from flask import Flask, request, jsonify
import joblib
import numpy as np
import os

app = Flask(__name__)

# Load pre-trained model
MODEL_PATH = os.environ.get("MODEL_PATH", "model.pkl")
try:
    model = joblib.load(MODEL_PATH)
except Exception as e:
    raise RuntimeError(f"Failed to load model from '{MODEL_PATH}': {e}")

# Ordered feature list – must match training column order
Q_IDS = [f"q{i}" for i in range(1, 16)]   # q1 … q15
VALID_VALUES = {0, 1, 2, 3}


@app.route('/health', methods=['GET'])
def health():
    """Simple liveness probe so Node can poll until the model is ready."""
    return jsonify({"status": "ok"})


@app.route('/predict', methods=['POST'])
def predict():
    body = request.get_json(silent=True)
    if not body or "answers" not in body:
        return jsonify({"error": "Request body must contain an 'answers' object."}), 400

    data = body["answers"]
    if not isinstance(data, dict):
        return jsonify({"error": "'answers' must be a JSON object."}), 400

    # Validate all 15 scale questions are present
    missing = [qid for qid in Q_IDS if qid not in data]
    if missing:
        return jsonify({
            "error": f"Missing answers for: {missing}. All 15 scale questions (q1-q15) are required."
        }), 400

    # Validate all values are in range
    invalid = {}
    for qid in Q_IDS:
        try:
            v = int(float(data[qid]))
            if v not in VALID_VALUES:
                invalid[qid] = data[qid]
        except (TypeError, ValueError):
            invalid[qid] = data[qid]

    if invalid:
        return jsonify({
            "error": f"Invalid values: {invalid}. Each answer must be 0, 1, 2, or 3."
        }), 400

    try:
        input_data = np.array(
            [int(float(data[qid])) for qid in Q_IDS]
        ).reshape(1, -1)

        prediction = model.predict(input_data)
        pred_int = int(prediction[0])
        label_map = {0: "low", 1: "mid", 2: "high"}

        return jsonify({
            "prediction": pred_int,
            "level": label_map.get(pred_int, "mid"),
        })

    except Exception as e:
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", 5000))
    app.run(host="0.0.0.0", port=port)
