from flask import Flask, jsonify, request

app = Flask(__name__)

RATE = 0.01


@app.get("/api/rate")
def rate():
    return jsonify(rate=RATE)


@app.post("/api/settle")
def settle():
    body = request.get_json(silent=True) or {}
    seconds = max(0, int(body.get("seconds", 0)))
    banked = float(body.get("banked", 0))
    return jsonify(balance=round(banked + seconds * RATE, 2))


if __name__ == "__main__":
    app.run(port=5001)
