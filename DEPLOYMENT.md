# Production Deployment Guide: CineFlow Agency System

This guide explains how to deploy your Video Editing Agency Management System to the web with production-grade security, custom domain, and SSL.

---

## Pre-Deployment Checklist

1. **Remove Demo Accounts or Change Passwords**:
   - The default admin account is `admin@videoagency.com`.
   - Before launching publicly, change the passwords or create your real administrator account.
2. **Generate Secure Secrets**:
   - Set a strong, 32+ character random string for `JWT_SECRET` and `COOKIE_SECRET`.
3. **Set `NODE_ENV=production`**:
   - Ensures secure cookie flags and optimal Express performance.

---

## Deployment Option 1: Railway (Recommended - Fastest & Easiest)

Railway supports both Node.js web services and managed MySQL with 1-click provisioning:

1. Push your project folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit for production"
   git remote add origin https://github.com/your-username/video-agency.git
   git branch -M main
   git push -u origin main
   ```
2. Go to **[Railway.app](https://railway.app/)** and click **New Project** → **Deploy from GitHub repo**.
3. In the Railway dashboard:
   - Click **+ New** → **Database** → **Add MySQL**.
   - Click on the newly created MySQL service → copy the connection variables (`MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT`).
4. On your Node app service in Railway, go to **Variables** and add:
   ```env
   NODE_ENV=production
   PORT=5000
   JWT_SECRET=your_super_strong_random_secret_32_characters_here
   COOKIE_SECRET=your_super_strong_cookie_secret_32_characters_here
   DB_TYPE=mysql
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   DB_NAME=${{MySQL.MYSQLDATABASE}}
   ```
5. In **Settings** → **Networking** → Click **Generate Domain** (or attach your custom domain e.g. `agency.yourdomain.com`).
6. Railway will build and launch your live application with automatic free SSL/HTTPS!

---

## Deployment Option 2: Render.com

1. Push code to GitHub.
2. Go to **[Render.com](https://render.com/)**:
   - Click **New** → **Web Service** → Select your repository.
   - Build Command: `npm install`
   - Start Command: `node server.js`
3. Add a MySQL database (via Render or external like PlanetScale / Aiven / Supabase) and enter the environment variables in the **Environment** tab:
   ```env
   NODE_ENV=production
   JWT_SECRET=...
   COOKIE_SECRET=...
   DB_TYPE=mysql
   DB_HOST=...
   DB_USER=...
   DB_PASSWORD=...
   DB_NAME=video_agency
   ```
4. Click **Deploy Web Service**.

---

## Deployment Option 3: VPS / Cloud Server (Ubuntu 22.04 / 24.04 with PM2 & Nginx)

If hosting on your own Linux server (DigitalOcean, AWS Lightsail, Linode, Hetzner):

### 1. Install Node.js, PM2, and MySQL
```bash
sudo apt update && sudo apt install -y nodejs npm mysql-server nginx
sudo npm install -g pm2
```

### 2. Configure MySQL Database
```bash
sudo mysql
```
Inside MySQL shell:
```sql
CREATE DATABASE video_agency CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'agency_admin'@'localhost' IDENTIFIED BY 'YourStrongPassword123!';
GRANT ALL PRIVILEGES ON video_agency.* TO 'agency_admin'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```
Import the schema:
```bash
mysql -u agency_admin -p video_agency < schema.sql
```

### 3. Deploy Code & Run with PM2
```bash
cd /var/www
git clone https://github.com/your-username/video-agency.git
cd video-agency
npm install --omit=dev

# Edit your production .env
nano .env

# Start with PM2
pm2 start server.js --name "cineflow-agency"
pm2 startup
pm2 save
```

### 4. Configure Nginx Reverse Proxy with Free SSL (Certbot)
Create `/etc/nginx/sites-available/videoagency`:
```nginx
server {
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable and get SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/videoagency /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Your system is now live on `https://yourdomain.com`!

---

## Deployment Option 4: Docker & Docker Compose

Run the entire stack (Node.js app + MySQL 8.0) in a single command on any Docker-enabled server:

```bash
docker-compose up -d --build
```
The application will launch on port 5000 with a connected MySQL 8.0 container initialized from `schema.sql`.

