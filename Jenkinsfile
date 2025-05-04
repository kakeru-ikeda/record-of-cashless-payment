pipeline {
    agent {
        label 'built-in'
    }
    
    environment {
        DOCKER_NETWORK = "jenkins-pipeline-network"
        DOCKER_HUB_CREDS = 'dockerhub-cred-id'
        DEPLOY_HOST = '192.168.40.99'
        DEPLOY_USER = 'server'
        IMAGE_NAME = 'record-of-cashless-payment'
        DISCORD_WEBHOOK = credentials('discord-webhook-url')
    }
    
    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }
    
    stages {       
        stage('Workspace Debug') {
            steps {
                echo "Debugging workspace information..."
                sh '''
                echo "Current workspace: $(pwd)"
                echo "Files in workspace:"
                ls -la
                echo "Parent directory:"
                ls -la ..
                echo "Environment variables:"
                env | sort
                '''
            }
        }
        
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
                    # 既存のコンテナとネットワークを強制的に停止・削除
                    docker-compose down --remove-orphans || true
                    docker stop $(docker ps -a -q --filter ancestor=${IMAGE_NAME}:latest --format="{{.ID}}") || true
                    docker rm $(docker ps -a -q --filter ancestor=${IMAGE_NAME}:latest --format="{{.ID}}") || true
                    
                    # 強制的にポート3000を使用しているコンテナを特定して停止
                    CONTAINER_USING_PORT=$(docker ps -q --filter publish=3000)
                    if [ ! -z "$CONTAINER_USING_PORT" ]; then
                        echo "Found container using port 3000: $CONTAINER_USING_PORT"
                        docker stop $CONTAINER_USING_PORT || true
                        docker rm $CONTAINER_USING_PORT || true
                    fi
                    
                    # 新しいコンテナをデプロイ
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
                        echo "SSH_KEY=$SSH_KEY"
                        echo "Current directory: $(pwd)"
                        
                        # SSHキーの存在確認とパーミッション（絶対パス形式で）
                        if [ -f "$SSH_KEY" ]; then
                            ls -la "$SSH_KEY"
                            echo "SSH key file exists"
                            wc -l "$SSH_KEY"
                            head -n1 "$SSH_KEY"
                        else
                            echo "SSH key file not found at path: $SSH_KEY"
                            # 代替方法として一時ファイルを作成
                            cp /home/server/.ssh/jenkins_deploy ~/.ssh/jenkins_deploy_temp
                            chmod 600 ~/.ssh/jenkins_deploy_temp
                            echo "Created temporary SSH key at ~/.ssh/jenkins_deploy_temp"
                            ls -la ~/.ssh/jenkins_deploy_temp
                        fi
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
                        // ファイルをリモートホストにコピー（ホストキー検証をスキップ）
                        sh "scp -o StrictHostKeyChecking=no -i \"${SSH_KEY}\" \"${FIREBASE_ADMIN_KEY}\" ${DEPLOY_USER}@${DEPLOY_HOST}:/tmp/firebase-admin-key.json"
                        
                        // リモートコマンドでデプロイを実行
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
                            
                            # 新しいコンテナを起動
                            docker run -d --name ${IMAGE_NAME} -p 3000:3000 \\
                            -e IMAP_SERVER=\"${IMAP_SERVER}\" \\
                            -e IMAP_USER=\"${IMAP_USER}\" \\
                            -e IMAP_PASSWORD=\"${IMAP_PASSWORD}\" \\
                            -e DISCORD_WEBHOOK_URL=\"${DISCORD_WEBHOOK_URL}\" \\
                            -e GOOGLE_APPLICATION_CREDENTIALS=\"/usr/src/app/firebase-admin-key.json\" \\
                            ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest
                            
                            # コンテナが起動していることを確認
                            echo "Waiting for container to start..."
                            sleep 5
                            
                            # ファイルをコンテナにコピー
                            docker cp /tmp/firebase-admin-key.json ${IMAGE_NAME}:/usr/src/app/firebase-admin-key.json
                            
                            # コンテナを再起動して設定を反映
                            docker restart ${IMAGE_NAME}
                            
                            # 一時ファイルを削除
                            rm -f /tmp/firebase-admin-key.json
                            
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
                docker-compose down --remove-orphans || true
                
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
            withCredentials([string(credentialsId: 'discord-webhook-url', variable: 'WEBHOOK_URL')]) {
                sh '''
                    # JSONをエスケープして正しく構築
                    JOB_NAME_ESC=$(echo "${JOB_NAME}" | sed 's/"/\\\\"/g')
                    BUILD_URL_ESC=$(echo "${BUILD_URL}" | sed 's/"/\\\\"/g')
                    
                    # Discord通知をcurlで送信（ビルド成功）- JSON形式を修正
                    curl -X POST -H "Content-Type: application/json" \\
                         -d "{\\\"content\\\":\\\"**ビルド成功** 🎉\\nジョブ: ${JOB_NAME_ESC}\\nビルド番号: #${BUILD_NUMBER}\\n詳細: ${BUILD_URL_ESC}\\\"}" \\
                         "${WEBHOOK_URL}"
                '''
            }
        }
        failure {
            echo 'Pipeline failed!'
            withCredentials([string(credentialsId: 'discord-webhook-url', variable: 'WEBHOOK_URL')]) {
                sh '''
                    # JSONをエスケープして正しく構築
                    JOB_NAME_ESC=$(echo "${JOB_NAME}" | sed 's/"/\\\\"/g')
                    BUILD_URL_ESC=$(echo "${BUILD_URL}" | sed 's/"/\\\\"/g')
                    
                    # Discord通知をcurlで送信（ビルド失敗）- JSON形式を修正
                    curl -X POST -H "Content-Type: application/json" \\
                         -d "{\\\"content\\\":\\\"**ビルド失敗** 🚨\\nジョブ: ${JOB_NAME_ESC}\\nビルド番号: #${BUILD_NUMBER}\\n詳細: ${BUILD_URL_ESC}\\\"}" \\
                         "${WEBHOOK_URL}"
                '''
            }
        }
    }
}
