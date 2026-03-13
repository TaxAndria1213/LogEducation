# 1. Image de base
FROM node:20-alpine

# 2. Créer un dossier de travail dans le container
WORKDIR /usr/src/app

# 3. Copier seulement les fichiers de dépendances
COPY package*.json ./

# 4. Installer les dépendances (inclut devDependencies, donc prisma)
RUN npm install

# 5. Copier le reste du code (y compris le dossier prisma/)
COPY . .

# 6. Générer le client Prisma dans l'image
RUN npx prisma generate

# 7. Indiquer le port exposé par l’app
EXPOSE 3045

# 8. Commande de démarrage (utilise ton script "start" avec nodemon + ts-node)
CMD ["npm", "start"]
