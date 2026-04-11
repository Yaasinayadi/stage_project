FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Exposer le port par défaut de Flask
EXPOSE 8000

# Lancer le serveur Flask
CMD ["python", "main.py"]
