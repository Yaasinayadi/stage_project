FROM node:20-alpine

WORKDIR /app

# Copie des fichiers de dépendances
COPY package.json package-lock.json* ./

# Installation des dépendances
RUN npm install

# Copie du reste des fichiers du frontend
COPY . .

# Exposition du port
EXPOSE 3000

# La commande de démarrage est gérée par docker-compose (npm run dev)
# mais on peut mettre une valeur par défaut
CMD ["npm", "run", "dev"]
