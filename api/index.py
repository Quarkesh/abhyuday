from flask import Flask, jsonify, request

app = Flask(__name__)

RUPEES = 0.20
PER_SECONDS = 300
RATE_PER_SECOND = RUPEES / PER_SECONDS


@app.get("/api/rate")
def rate():
    return jsonify(rate=RATE_PER_SECOND)


@app.post("/api/settle")
def settle():
    body = request.get_json(silent=True) or {}
    seconds = max(0, int(body.get("seconds", 0)))
    banked = float(body.get("banked", 0))
    earned = seconds * RATE_PER_SECOND
    return jsonify(earned=round(earned, 6), balance=round(banked + earned, 6))


if __name__ == "__main__":
    app.run(port=5001)
