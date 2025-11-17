# Deploying FileSearch to Render

This guide will walk you through deploying the FileSearch application to Render.

## Prerequisites

1. A GitHub account with this repository pushed
2. A Render account (sign up at https://render.com)
3. A Google Gemini API key (get one at https://aistudio.google.com/app/apikey)

## Deployment Steps

### Option 1: Using render.yaml (Recommended)

1. **Connect Your Repository to Render**
   - Go to https://render.com/dashboard
   - Click "New +" and select "Blueprint"
   - Connect your GitHub account if you haven't already
   - Select the `FileSearch` repository
   - Render will automatically detect the `render.yaml` file

2. **Configure Environment Variables**
   - During the setup, you'll be asked to provide:
     - `GEMINI_API_KEY`: Your Google Gemini API key
   - The `JWT_SECRET_KEY` will be auto-generated
   - The database connection will be auto-configured

3. **Deploy**
   - Click "Apply" to start the deployment
   - Render will create:
     - PostgreSQL database
     - Backend service (Flask API)
     - Frontend service (Static site)

4. **Wait for Deployment**
   - The initial deployment may take 5-10 minutes
   - Watch the logs to ensure everything deploys successfully

5. **Access Your Application**
   - Once deployed, you'll get URLs for:
     - Frontend: `https://filesearch-frontend.onrender.com`
     - Backend: `https://filesearch-backend.onrender.com`

### Option 2: Manual Setup

If you prefer to set up services manually:

#### 1. Create PostgreSQL Database

1. Go to Render Dashboard
2. Click "New +" → "PostgreSQL"
3. Name it `filesearch-db`
4. Choose the Free plan
5. Click "Create Database"
6. Copy the "Internal Database URL" for later use

#### 2. Deploy Backend

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `filesearch-backend`
   - **Region**: Oregon (US West)
   - **Branch**: `master`
   - **Root Directory**: (leave empty)
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `cd backend && gunicorn --bind 0.0.0.0:$PORT --workers 1 --timeout 120 app:app`

4. Add Environment Variables:
   - `GEMINI_API_KEY`: Your API key
   - `JWT_SECRET_KEY`: Generate a random string (or let Render generate one)
   - `DATABASE_URL`: The Internal Database URL from step 1

5. Click "Create Web Service"

#### 3. Deploy Frontend

1. Click "New +" → "Static Site"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `filesearch-frontend`
   - **Branch**: `master`
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Publish Directory**: `frontend/dist`

4. Add Environment Variable:
   - `VITE_API_URL`: `https://filesearch-backend.onrender.com/api`

5. Click "Create Static Site"

## Post-Deployment

### Create Admin User

After the backend is deployed, you need to create an admin user:

1. Go to your backend service on Render
2. Click on "Shell" tab
3. Run these commands:
   ```bash
   cd backend
   python -c "from models import init_db, get_session, User; from bcrypt import hashpw, gensalt; session = get_session(); user = User(username='admin', password_hash=hashpw('admin123'.encode('utf-8'), gensalt()).decode('utf-8'), is_admin=True); session.add(user); session.commit(); print('Admin user created')"
   ```

### Update Frontend API URL

If you used manual setup and your backend URL is different:

1. Go to your frontend service settings
2. Update the `VITE_API_URL` environment variable with your actual backend URL
3. Trigger a manual deploy

## Important Notes

### Free Tier Limitations

- **Database**: 90 days free, then $7/month
- **Web Services**: Services spin down after 15 minutes of inactivity
- **Cold Start**: First request after inactivity may take 30-60 seconds

### Production Recommendations

1. **Upgrade Plans**: Consider paid plans for production use
2. **Custom Domain**: Add a custom domain in Render settings
3. **Monitoring**: Set up health check alerts
4. **Backups**: Enable automatic database backups
5. **Environment Variables**: Never commit `.env` files; always use Render's environment variables

### Security Considerations

1. **Change Default Credentials**: After deployment, immediately change the admin password
2. **JWT Secret**: Use a strong, randomly generated JWT_SECRET_KEY
3. **CORS**: Update CORS settings in `backend/app.py` to only allow your frontend domain
4. **HTTPS**: Render provides free SSL certificates; ensure all traffic uses HTTPS

## Troubleshooting

### Backend Won't Start

- Check the logs for Python errors
- Verify all environment variables are set
- Ensure database connection is working

### Frontend Can't Connect to Backend

- Verify `VITE_API_URL` is set correctly
- Check CORS settings in backend
- Ensure backend is running and healthy

### Database Connection Issues

- Check if DATABASE_URL is set correctly
- Verify the database is running
- Check database connection limits

## Support

For issues specific to Render, check:
- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)

For application issues, create an issue on the GitHub repository.
