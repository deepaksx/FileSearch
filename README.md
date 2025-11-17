# File Search Web App with Gemini API

A full-stack web application that allows users to upload multiple files and query them using Google's Gemini AI File Search API. Built with React and Flask, this app provides an intuitive chat interface to get actionable insights from your documents.

## Features

- **Multiple File Upload**: Drag-and-drop or browse to upload multiple files at once
- **Supported File Types**: PDF, DOCX, TXT, JSON, Markdown, CSV, HTML, XML, and code files
- **AI-Powered Search**: Uses Google's Gemini 2.0 Flash with RAG (Retrieval Augmented Generation)
- **Chat Interface**: Natural language queries to extract information from your documents
- **Citations**: View which documents were used to generate responses
- **Modern UI**: Clean, responsive interface with real-time feedback

## Architecture

```
FileSearch/
├── backend/              # Flask API server
│   ├── app.py           # Main Flask application
│   └── requirements.txt # Python dependencies
├── frontend/            # React web application
│   ├── src/
│   │   ├── components/  # React components
│   │   │   ├── FileUpload.jsx
│   │   │   ├── ChatInterface.jsx
│   │   │   └── *.css
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
└── .env.example         # Environment variables template
```

## Prerequisites

- Python 3.8 or higher
- Node.js 18 or higher
- Google Gemini API key ([Get it here](https://aistudio.google.com/app/apikey))

## Setup Instructions

### 1. Clone or Download the Project

Navigate to the FileSearch directory:
```bash
cd FileSearch
```

### 2. Set Up the Backend

#### Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

#### Configure Environment Variables

Create a `.env` file in the root directory:

```bash
# From the FileSearch root directory
cp .env.example .env
```

Edit `.env` and add your Gemini API key:
```
GEMINI_API_KEY=your_actual_api_key_here
```

### 3. Set Up the Frontend

```bash
cd frontend
npm install
```

## Running the Application

You'll need two terminal windows to run both the backend and frontend.

### Terminal 1: Start the Backend Server

```bash
cd backend
python app.py
```

The Flask server will start at `http://localhost:5000`

### Terminal 2: Start the Frontend Development Server

```bash
cd frontend
npm run dev
```

The React app will start at `http://localhost:3000`

## Usage

1. **Open your browser** and navigate to `http://localhost:3000`

2. **Upload Files**:
   - Drag and drop files onto the upload area, or
   - Click "Browse Files" to select files from your computer
   - Click "Upload" to send files to the AI

3. **Ask Questions**:
   - Once files are uploaded, you'll see the chat interface
   - Type your question in the text area
   - Press Enter or click "Send"
   - View AI responses with citations showing which documents were referenced

4. **Upload New Files**:
   - Click "Upload New Files" button to start over with different documents

## Example Queries

Try asking questions like:
- "Summarize the main points from these documents"
- "What are the key findings in the research paper?"
- "Find information about [specific topic]"
- "Compare and contrast the approaches described in these files"
- "Extract all dates and events mentioned"

## API Endpoints

### Backend API

- `GET /api/health` - Health check
- `POST /api/upload` - Upload files and create file search store
- `POST /api/chat` - Query the uploaded files
- `GET /api/stores` - List all file search stores

## Technology Stack

### Backend
- **Flask** - Web framework
- **google-generativeai** - Gemini API client
- **Flask-CORS** - Cross-origin resource sharing

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **Axios** - HTTP client

## Troubleshooting

### Backend Issues

**Error: GEMINI_API_KEY environment variable not set**
- Make sure you created the `.env` file in the root directory
- Verify your API key is correctly set in the `.env` file

**Port 5000 already in use**
- Change the port in `backend/app.py` (last line)
- Update the proxy in `frontend/vite.config.js` to match

### Frontend Issues

**Port 3000 already in use**
- Change the port in `frontend/vite.config.js` server settings

**Cannot connect to backend**
- Ensure the Flask server is running
- Check that the proxy configuration in `vite.config.js` matches your backend URL

## Cost Considerations

Google Gemini API pricing for File Search:
- **Embeddings**: $0.15 per 1M tokens at indexing time
- **Storage**: Free
- **Queries**: Standard Gemini API rates apply

For current pricing, visit: [Google AI Studio Pricing](https://ai.google.dev/pricing)

## Security Notes

- Never commit your `.env` file with real API keys
- The `.env.example` file is provided as a template only
- Keep your API key secure and rotate it if exposed

## Future Enhancements

Potential features to add:
- File management (delete, re-index)
- Multiple conversation threads
- Export chat history
- Advanced search filters
- User authentication
- File preview functionality

## License

This project is provided as-is for educational and development purposes.

## Contributing

Feel free to fork, modify, and improve this application!

## Resources

- [Gemini API File Search Documentation](https://ai.google.dev/gemini-api/docs/file-search)
- [Google AI Studio](https://aistudio.google.com/)
- [React Documentation](https://react.dev/)
- [Flask Documentation](https://flask.palletsprojects.com/)
