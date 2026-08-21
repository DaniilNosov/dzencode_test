# Real-Time Comments SPA

A full-stack Single Page Application for discussions and nested comments with real-time updates.

Features

*   **Real-time Updates:** Instant comment delivery without page reloads using WebSockets (Django Channels) and Redis PubSub.
*   **GraphQL API:** Optimized data fetching and mutations via Apollo Client and Graphene.
*   **Nested Threads:** Unlimited depth for comment replies utilizing the MPTT (Modified Preorder Tree Traversal) algorithm.
*   **Security & Validation:** Built-in CAPTCHA generation, HTML sanitization (DOMPurify/Bleach), and strict file upload validation.
*   **Rich Media:** Support for image attachments (with auto-resizing to 320x240 max) and `.txt` files (up to 100kb).
*   **Dockerized:** Fully containerized architecture for instant deployment.

Tech Stack

*   **Backend:** Python 3.13, Django 6.1, Graphene (GraphQL), Django Channels
*   **Frontend:** React, TypeScript, Apollo Client, DOMPurify
*   **Infrastructure:** Docker, Docker Compose, Redis (PubSub), MySQL

Quick Start (Running Locally)

1. Make sure you have **Docker** and **Docker Compose** installed on your machine.
2. Clone this repository:
   ```bash
   git clone <https://github.com/DaniilNosov/dzencode_test>
   cd dzencode_test
Start the application using Docker Compose:

Bash
docker-compose up -d --build
Wait a few moments for the containers to initialize (API, Frontend, MySQL, Redis, Celery).

Open your browser and go to: http://localhost:5173

Note: The backend API and GraphQL playground are running on http://localhost:8000/graphql/.

Project Structure
backend/ - Django application, GraphQL schema, WebSocket consumers, and database models.

frontend/ - React/Vite application with Apollo Client setup and UI components.

docker-compose.yml - Services configuration for seamless orchestration.

database_schema.png - ER diagram of the database structure.
