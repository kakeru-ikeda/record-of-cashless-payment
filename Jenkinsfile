pipeline {
    agent any
    
    environment {
        DOCKER_NETWORK = "jenkins-pipeline-network"
        DOCKER_HUB_CREDS = 'dockerhub-cred-id'
        DEPLOY_HOST = '192.168.40.99'
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
                withCredentials([
                    string(credentialsId: 'IMAP_SERVER', variable: 'IMAP_SERVER'),
                    string(credentialsId: 'IMAP_USER', variable: 'IMAP_USER'),
                    string(credentialsId: 'IMAP_PASSWORD', variable: 'IMAP_PASSWORD'),
                    string(credentialsId: 'DISCORD_WEBHOOK_URL', variable: 'DISCORD_WEBHOOK_URL'),
                    string(credentialsId: 'GOOGLE_APPLICATION_CREDENTIALS', variable: 'GOOGLE_APPLICATION_CREDENTIALS'),
                    file(credentialsId: 'FIREBASE_ADMIN_KEY', variable: 'FIREBASE_ADMIN_KEY')
                ]) {
                    sh '''
                    # 古いコンテナの停止と削除
                    docker stop ${IMAGE_NAME} || true
                    docker rm ${IMAGE_NAME} || true
                    
                    # 新しいコンテナの起動
                    docker run -d -p 3000:3000 \\
                      --name ${IMAGE_NAME} \\
                      -e PORT=3000 \\
                      -e TZ=Asia/Tokyo \\
                      -e IMAP_SERVER="${IMAP_SERVER}" \\
                      -e IMAP_USER="${IMAP_USER}" \\
                      -e IMAP_PASSWORD="${IMAP_PASSWORD}" \\
                      -e DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL}" \\
                      -e GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS}" \\
                      ${IMAGE_NAME}:latest
                    
                    # Firebaseキーのコピー
                    docker cp ${FIREBASE_ADMIN_KEY} ${IMAGE_NAME}:/usr/src/app/firebase-admin-key.json
                    '''
                    
                    // ヘルスチェック待機
                    timeout(time: 1, unit: 'MINUTES') {
                        retry(5) {
                            sleep(time: 10, unit: 'SECONDS')
                            sh 'curl -f http://localhost:3000/health || exit 1'
                        }
                    }
                }
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

        stage('Debug SSH Key') {
            steps {
                script {
                    withCredentials([sshUserPrivateKey(
                        credentialsId: 'jenkins_deploy',
                        keyFileVariable: 'SSH_KEY',
                        usernameVariable: 'SSH_USER'
                    )]) {
                        sh '''
                        echo "===== SSH DEBUG ====="
                        echo "SSH_USER=$SSH_USER"
                        ls -l $SSH_KEY                   # ファイルの有無とパーミッションを確認
                        wc -l $SSH_KEY                   # 行数を表示（4096bit RSAならだいたい > 40行）
                        head -n1 $SSH_KEY                # -----BEGIN OPENSSH PRIVATE KEY----- が見えればOK
                        echo "===================="
                        '''
                    }
                }
            }
        }
        
        stage('Deploy to Home') {
            steps {
                echo "Deploying to home server..."
                script {
                    withCredentials([
                        string(credentialsId: 'IMAP_SERVER', variable: 'IMAP_SERVER'),
                        string(credentialsId: 'IMAP_USER', variable: 'IMAP_USER'),
                        string(credentialsId: 'IMAP_PASSWORD', variable: 'IMAP_PASSWORD'),
                        string(credentialsId: 'DISCORD_WEBHOOK_URL', variable: 'DISCORD_WEBHOOK_URL'),
                        string(credentialsId: 'GOOGLE_APPLICATION_CREDENTIALS', variable: 'GOOGLE_APPLICATION_CREDENTIALS'),
                        file(credentialsId: 'FIREBASE_ADMIN_KEY', variable: 'FIREBASE_ADMIN_KEY'),
                        usernamePassword(credentialsId: env.DOCKER_HUB_CREDS, usernameVariable: 'DOCKER_HUB_CREDS_USR', passwordVariable: 'DOCKER_HUB_CREDS_PSW'),
                        sshUserPrivateKey(
                            credentialsId: 'jenkins_deploy',
                            keyFileVariable: 'SSH_KEY',
                            usernameVariable: 'SSH_USER'
                        )
                    ]) {
                        sshCommand remote: [
                            name: 'Home Server',
                            host: env.DEPLOY_HOST,
                            user: env.DEPLOY_USER,
                            identityFile: env.SSH_KEY,
                            port: 22,
                            allowAnyHosts: true,
                            timeout: 60
                        ], command: """
                            docker pull ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest
                            docker stop ${IMAGE_NAME} || true
                            docker rm ${IMAGE_NAME} || true
                            docker cp ${FIREBASE_ADMIN_KEY} ${IMAGE_NAME}:/app/firebase-admin-key.json

                            docker run -d -p 3000:3000 \\
                            -e IMAP_SERVER=\\"${IMAP_SERVER}\\" \\
                            -e IMAP_USER=\\"${IMAP_USER}\\" \\
                            -e IMAP_PASSWORD=\\"${IMAP_PASSWORD}\\" \\
                            -e DISCORD_WEBHOOK_URL=\\"${DISCORD_WEBHOOK_URL}\\" \\
                            -e GOOGLE_APPLICATION_CREDENTIALS=\\"${GOOGLE_APPLICATION_CREDENTIALS}\\" \\
                            ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest
                            
                            docker ps
                        """
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
