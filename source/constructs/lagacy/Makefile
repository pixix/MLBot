build:
	sam build

deploy: build samconfig.toml
	sam deploy

samconfig.toml:
	sam deploy --guided

serve: build
	sam local start-api

test:
	PYTHONPATH=/Users/liangfc/workspace/mlbot/source/lambda/ml_bot python3 -m pytest tests/ -v
