import requests

print ( 
    requests.post(
        "https://researchagent-sooy.onrender.com",
        json={
            "query": "who is greg brockman openai?"
        }
    ).json()
)