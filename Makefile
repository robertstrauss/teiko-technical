PYTHON = python3
NPM = npm
BACKEND_PORT=3000
FRONTEND_PORT=3000
# NVM = ${NVM_DIR}/nvm.sh

# Setup target, to install dependencies
setup:
	@echo "Installing Python dependencies..."
	pip install -r requirements.txt
	@echo "Updating Node.js..."
# 	$(NVM) install 20
# 	$(NVM) use 20
# 	$(NVM) alias default 20
	@echo "Installing Node dependencies..."
	$(NPM) install

# Pipeline Target to run data processing and static plot generation sequentially.
pipeline:
	@echo "Initializing database and loading data..."
	$(PYTHON) load_data.py
	@echo "Generating output tables and plots..."

# Dashboard Target to run both the backend and frontend simultaneously.
dashboard:
	@echo "Configuring environment variables for API URL..."
	@if [ -n "$$CODESPACE_NAME" ]; then \
		echo "Codespace detected. Building public URL..."; \
		echo "VITE_API_URL=https://$$CODESPACE_NAME-$(BACKEND_PORT).app.github.dev" > .env; \
		echo "REACT_APP_API_URL=https://$$CODESPACE_NAME-$(BACKEND_PORT).app.github.dev" >> .env; \
		echo "Unlocking backend port..."; \
		 \
	else \
		echo "Local environment detected. Using localhost..."; \
		echo "VITE_API_URL=http://localhost:$(BACKEND_PORT)" > .env; \
		echo "REACT_APP_API_URL=http://localhost:$(BACKEND_PORT)" >> .env; \
	fi
	@echo ".env file successfully written."
	@echo "Starting backend and frontend servers..."
	# We use npx concurrently to run two blocking servers in the same terminal
# 	npx concurrently \
# 		"./load_data.py server" \
# 		"sleep 6 && npm start" \
# 		"sleep 5 && @if [ -n "$$CODESPACE_NAME" ] gh codespace ports visibility ${BACKEND_PORT}:public -c $$CODESPACE_NAME; fi"
		# unlocks backend port, so requests from the app go through
	npm run build
	./load_data.py server