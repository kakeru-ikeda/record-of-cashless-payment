pipeline {
    agent any
    
    environment {
        DOCKER_NETWORK = "jenkins-pipeline-network"
        DOCKER_HUB_CREDS = 'dockerhub-cred-id'
        SSH_CREDS = 'home-server-ssh-id'
        DEPLOY_HOST = 'welcome-to-sukisuki-club.duckdns.org'
        DEPLOY_USER = 'server'
        IMAGE_NAME = 'record-of-cashless-payment'
    }
    
    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }
    
    stages {       
        stage('Checkout') {
            steps {
                echo "Checking out source code..."
                checkout scm
            }
        }
        
        stage('Build') {
            steps {
                echo "Building Docker image..."
                sh '''
                docker network create ${DOCKER_NETWORK} || true
                docker-compose build
                '''
            }
        }
        
        stage('Test') {
            steps {
                echo "Running tests..."
                sh '''
                # Build Docker image with test target
                docker build --target test .
                
                # Alternative approach: Build image first and then run tests in a container
                # docker build --target test -t ${IMAGE_NAME}:test .
                # docker run --rm --name test-container ${IMAGE_NAME}:test npm test
                '''
            }
        }
        
        stage('Deploy') {
            steps {
                echo "Deploying application..."
                sh '''
                docker-compose down || true
                docker-compose up -d
                '''
                echo 'Deployment completed'
            }
        }
        
        stage('Publish') {
            steps {
                echo "Publishing Docker image..."
                script {
                    withCredentials([usernamePassword(credentialsId: env.DOCKER_HUB_CREDS, passwordVariable: 'DOCKER_HUB_CREDS_PSW', usernameVariable: 'DOCKER_HUB_CREDS_USR')]) {
                        sh '''
                        # Login to Docker Hub
                        echo $DOCKER_HUB_CREDS_PSW | docker login -u $DOCKER_HUB_CREDS_USR --password-stdin
                        
                        # Tag the image
                        docker tag ${IMAGE_NAME}:latest ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest
                        docker tag ${IMAGE_NAME}:latest ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:${BUILD_NUMBER}
                        
                        # Push the images
                        docker push ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest
                        docker push ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:${BUILD_NUMBER}
                        
                        # Logout
                        docker logout
                        '''
                    }
                }
            }
        }
        
        stage('Deploy to Home') {
            steps {
                echo "Deploying to home server..."
                script {
                    sshagent([env.SSH_CREDS]) {
                        sh '''
                        # SSH to home server and deploy
                        ssh -o StrictHostKeyChecking=no ${DEPLOY_USER}@${DEPLOY_HOST} << EOF
                        # Pull the latest image
                        docker pull ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest
                        
                        # Stop and remove existing container if any
                        docker stop ${IMAGE_NAME} || true
                        docker rm ${IMAGE_NAME} || true
                        
                        # Run the new container
                        docker run -d --name ${IMAGE_NAME} -p 3000:3000 ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest
                        
                        # Show running containers
                        docker ps
                        EOF
                        '''
                    }
                }
                echo "Deployment to home server completed"
            }
        }
    }
    
    post {
        always {
            echo "Cleaning up..."
            sh '''
                # Stop and remove all containers started by docker-compose
                docker-compose down
                
                # Clean up any dangling images to free up space
                docker image prune -f
                
                # Remove the network if it exists
                docker network rm ${DOCKER_NETWORK} || true
            '''
            
            // Clean up workspace
            cleanWs()
        }
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed!'
        }
    }
}
