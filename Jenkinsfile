pipeline {
    agent any
    
    environment {
        DOCKER_NETWORK = "jenkins-pipeline-network"
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
                # Run tests in a container, using the network so MongoDB can be accessed
                docker run --rm --network=${DOCKER_NETWORK} \
                    -v $(pwd):/app -w /app \
                    node:18 \
                    sh -c "npm install && npm test"
                '''
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
    }
}

