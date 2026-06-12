PYTHON = python3
NPM = npm
NVM = ${NVM_DIR}/nvm.sh
PORT=8000

# Setup target, to install dependencies
setup:
	@echo "Installing Python dependencies..."
	pip install -r requirements.txt
	@echo "Updating Node.js..."
	$(NVM) install 20
	$(NVM) use 20
	$(NVM) alias default 20
	@echo "Installing Node dependencies..."
	$(NPM) install

# Pipeline Target to run data processing and static plot generation sequentially.
pipeline:
	@echo "Initializing database and loading data..."
	$(PYTHON) load_data.py
	@echo "Generating output tables and plots..."

# Dashboard Target to run both the backend and frontend simultaneously.
dashboard:
	@echo "Building dashboard..."
	npm run build
	@echo "Built! Starting server..."
	@if [ -n "$$CODESPACE_NAME" ]; then \
		echo "Dashboard available at https://$$CODESPACE_NAME-$(PORT).app.github.dev"; \
	else \
		echo "Dashboard available at http://localhost:$(PORT)"; \
	fi
	./load_data.py server