# AWS Resources Architecture

This document outlines the AWS services utilized in the Proplytics project, detailing what they are, where they are used, and why they were chosen for the infrastructure.

## 1. AWS Amplify (Frontend Hosting)
- **What**: Fully managed hosting service for static web apps and frontend frameworks.
- **Where**: Deploys the built React/Vite application from the `dist/` directory. 
- **Why**: Amplify provides seamless continuous deployment, automatic SSL, and a globally distributed CDN. It simplifies hosting the SPA (Single Page Application) and integrates easily with the deployment scripts (`deploy-aws.ps1`).

## 2. Amazon Elastic Container Registry (ECR)
- **What**: A fully managed Docker container registry.
- **Where**: Stores the `proplytics-backend` Docker images built from the `backend/` folder.
- **Why**: Provides a secure, scalable, and highly available registry to store backend container images before they are pulled by ECS for deployment.

## 3. Amazon Elastic Container Service (ECS)
- **What**: A highly scalable, high-performance container orchestration service.
- **Where**: Runs the Node.js backend application (`proplytics-backend-service` in the `proplytics-cluster`).
- **Why**: Allows us to run the backend as a containerized microservice without managing underlying servers (via Fargate). Crucial for handling long-running AI streaming requests (SSE) which might timeout on standard serverless functions like AWS Lambda (which has a 29s timeout).

## 4. Amazon CloudFront (CDN)
- **What**: A fast content delivery network (CDN) service.
- **Where**: Sits in front of the backend ECS service (`d6opkcrsagj0v.cloudfront.net`). The deployment script dynamically updates the origin to point to the latest ECS task's public DNS.
- **Why**: Provides a single, secure, HTTPS-enabled entry point for the frontend to communicate with the backend. It handles routing and can provide caching and DDoS protection.

## 5. AWS Systems Manager (SSM) Parameter Store
- **What**: Provides secure, hierarchical storage for configuration data management and secrets management.
- **Where**: Stores the `GEMINI_API_KEY` (`/proplytics/dev/GEMINI_API_KEY`) which is accessed by the backend during runtime.
- **Why**: Keeps sensitive API keys out of the source code and environment files. It allows the ECS containers to securely fetch secrets dynamically.

## 6. Amazon EC2 / Elastic Network Interfaces (ENI)
- **What**: Virtual networking components.
- **Where**: Attached to the running ECS tasks to provide them with a public IP and DNS name.
- **Why**: Necessary for the CloudFront distribution to route incoming internet traffic to the specific container instance running the backend server.

## 7. Amazon S3 (Simple Storage Service)
- **What**: Object storage service offering industry-leading scalability, data availability, security, and performance.
- **Where**: Used for storing proposal revision history and generated PDF documents.
- **Why**: Provides durable and cheap storage for versioned proposals, allowing the application to fetch and diff previous proposal states seamlessly.
