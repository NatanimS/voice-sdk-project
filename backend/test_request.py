import requests

test_phrases = [
    "ሰላም እንደምን ነህ",       # "Hello, how are you"
    "አመሰግናለሁ",              # "Thank you"
    "ስንት ሰዓት ነው",           # "What time is it"
]

for i, phrase in enumerate(test_phrases, start=1):
    response = requests.post(
        "http://localhost:8000/api/v1/tts",
        headers={"X-API-Key": "dev_local_key_123"},
        json={"text": phrase, "language": "am"},
    )
    if response.status_code == 200:
        filename = f"quality_test_{i}.wav"
        with open(filename, "wb") as f:
            f.write(response.content)
        print(f"Saved {filename} for phrase: {phrase}")
    else:
        print(f"Error on phrase '{phrase}':", response.status_code, response.text)