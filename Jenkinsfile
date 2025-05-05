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
        DISCORD_WEBHOOK = credentials('DISCORD_WEBHOOK_JENKINS_LOG_URL')
        JENKINS_URL_FULL = 'https://welcome-to-sukisuki-club.duckdns.org/jenkins'
    }
    
    options {
        timestamps()
        timeout(time: 30, unit: 'MINUTES')
    }
    
    stages {       
        stage('Workspace Debug') {
            steps {
                echo "ワークスペース情報をデバッグ中..."
                sh '''
                echo "現在のワークスペース: $(pwd)"
                echo "ワークスペース内のファイル:"
                ls -la
                echo "親ディレクトリ:"
                ls -la ..
                echo "環境変数:"
                env | sort
                '''
            }
        }
        
        stage('Checkout') {
            steps {
                echo "ソースコードをチェックアウト中..."
                checkout scm
            }
        }
               
        stage('Build') {
            steps {
                echo "Dockerイメージをビルド中..."
                sh '''
                docker network create ${DOCKER_NETWORK} || true
                docker-compose build
                '''
            }
        }
        
        stage('Test') {
            steps {
                echo "テストを実行中..."
                sh '''
                # テスト用Dockerイメージをビルド
                docker build --target test .
                
                # 代替アプローチ：イメージを先にビルドしてからテストを実行するコンテナで実行
                # docker build --target test -t ${IMAGE_NAME}:test .
                # docker run --rm --name test-container ${IMAGE_NAME}:test npm test
                '''
            }
        }
        
        stage('Deploy') {
            steps {
                echo "アプリケーションをデプロイ中..."
                sh '''
                    # 既存のコンテナとネットワークを強制的に停止・削除
                    docker-compose down --remove-orphans || true
                    docker stop $(docker ps -a -q --filter ancestor=${IMAGE_NAME}:latest --format="{{.ID}}") || true
                    docker rm $(docker ps -a -q --filter ancestor=${IMAGE_NAME}:latest --format="{{.ID}}") || true
                    
                    # 強制的にポート3000を使用しているコンテナを特定して停止
                    CONTAINER_USING_PORT=$(docker ps -q --filter publish=3000)
                    if [ ! -z "$CONTAINER_USING_PORT" ]; then
                        echo "ポート3000を使用しているコンテナを発見: $CONTAINER_USING_PORT"
                        docker stop $CONTAINER_USING_PORT || true
                        docker rm $CONTAINER_USING_PORT || true
                    fi
                    
                    # 新しいコンテナをデプロイ
                    docker-compose up -d
                '''
                echo 'デプロイが完了しました'
            }
        }
        
        stage('Publish') {
            steps {
                echo "Dockerイメージを公開中..."
                script {
                    withCredentials([usernamePassword(credentialsId: env.DOCKER_HUB_CREDS, passwordVariable: 'DOCKER_HUB_CREDS_PSW', usernameVariable: 'DOCKER_HUB_CREDS_USR')]) {
                        sh '''
                        # Docker Hubにログイン
                        echo $DOCKER_HUB_CREDS_PSW | docker login -u $DOCKER_HUB_CREDS_USR --password-stdin
                        
                        # イメージにタグを付ける
                        docker tag ${IMAGE_NAME}:latest ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest
                        docker tag ${IMAGE_NAME}:latest ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:${BUILD_NUMBER}
                        
                        # イメージをプッシュ
                        docker push ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:latest
                        docker push ${DOCKER_HUB_CREDS_USR}/${IMAGE_NAME}:${BUILD_NUMBER}
                        
                        # ログアウト
                        docker logout
                        '''
                    }
                }
            }
        }
        
        stage('Deploy to Home') {
            steps {
                echo "ホームサーバーにデプロイ中..."
                script {
                    withCredentials([
                        string(credentialsId: 'IMAP_SERVER', variable: 'IMAP_SERVER'),
                        string(credentialsId: 'IMAP_USER', variable: 'IMAP_USER'),
                        string(credentialsId: 'IMAP_PASSWORD', variable: 'IMAP_PASSWORD'),
                        string(credentialsId: 'DISCORD_WEBHOOK_URL', variable: 'DISCORD_WEBHOOK_URL'),
                        string(credentialsId: 'DISCORD_WEBHOOK_JENKINS_LOG_URL', variable: 'DISCORD_WEBHOOK_JENKINS_LOG_URL'),
                        string(credentialsId: 'GOOGLE_APPLICATION_CREDENTIALS', variable: 'GOOGLE_APPLICATION_CREDENTIALS'),
                        file(credentialsId: 'FIREBASE_ADMIN_KEY', variable: 'FIREBASE_ADMIN_KEY'),
                        usernamePassword(credentialsId: env.DOCKER_HUB_CREDS, usernameVariable: 'DOCKER_HUB_CREDS_USR', passwordVariable: 'DOCKER_HUB_CREDS_PSW'),
                        sshUserPrivateKey(
                            credentialsId: 'jenkins_deploy',
                            keyFileVariable: 'SSH_KEY',
                            usernameVariable: 'SSH_USER'
                        )
                    ]) {
                        sh '''
                            scp -o StrictHostKeyChecking=no -i "$SSH_KEY" "$FIREBASE_ADMIN_KEY" ''' + "${env.DEPLOY_USER}@${env.DEPLOY_HOST}" + ''':/tmp/firebase-admin-key.json

                            # 環境変数ファイルを作成
                            cat > /tmp/env_vars.sh << EOL
                            IMAP_SERVER="$IMAP_SERVER"
                            IMAP_USER="$IMAP_USER"
                            IMAP_PASSWORD="$IMAP_PASSWORD"
                            DISCORD_WEBHOOK_URL="$DISCORD_WEBHOOK_URL"
                            DOCKER_HUB_USER="$DOCKER_HUB_CREDS_USR"
                            IMAGE_NAME="$IMAGE_NAME"
                            EOL

                            # ファイル内容を確認
                            echo "環境変数ファイルの内容:"
                            cat /tmp/env_vars.sh
                            
                            # ファイルを安全に転送
                            scp -o StrictHostKeyChecking=no -i "$SSH_KEY" /tmp/env_vars.sh ''' + "${env.DEPLOY_USER}@${env.DEPLOY_HOST}" + ''':/tmp/env_vars.sh
                        '''
                        
                        sshCommand remote: [
                            name: 'Home Server',
                            host: env.DEPLOY_HOST,
                            user: env.DEPLOY_USER,
                            identityFile: SSH_KEY,
                            port: 22,
                            allowAnyHosts: true,
                            timeout: 60
                        ], command: '''
                            # 環境変数を読み込む
                            chmod +x /tmp/env_vars.sh
                            source /tmp/env_vars.sh

                            # 環境変数を確認
                            echo "IMAP_SERVER: $IMAP_SERVER"
                            echo "IMAP_USER: $IMAP_USER"
                            echo "IMAP_PASSWORD: $IMAP_PASSWORD"
                            echo "DISCORD_WEBHOOK_URL: $DISCORD_WEBHOOK_URL"
                            echo "DOCKER_HUB_USER: $DOCKER_HUB_USER"
                            echo "IMAGE_NAME: $IMAGE_NAME"
                            
                            # Dockerコマンドを実行
                            docker pull $DOCKER_HUB_USER/$IMAGE_NAME:latest
                            docker stop $IMAGE_NAME || true
                            docker rm $IMAGE_NAME || true
                            
                            # 新しいコンテナを起動
                            docker run -d --name $IMAGE_NAME -p 3000:3000 \\
                            -e IMAP_SERVER="$IMAP_SERVER" \\
                            -e IMAP_USER="$IMAP_USER" \\
                            -e IMAP_PASSWORD="$IMAP_PASSWORD" \\
                            -e DISCORD_WEBHOOK_URL="$DISCORD_WEBHOOK_URL" \\
                            -e GOOGLE_APPLICATION_CREDENTIALS="/usr/src/app/firebase-admin-key.json" \\
                            -v /tmp/firebase-admin-key.json:/usr/src/app/firebase-admin-key.json \\
                            $DOCKER_HUB_USER/$IMAGE_NAME:latest
                            
                            # コンテナの起動を待機中
                            echo "コンテナの起動を待機中..."
                            sleep 10

                            # デプロイ後の稼働確認
                            docker ps
                            
                            # コンテナの詳細情報を表示
                            CONTAINER_ID=$(docker ps -qa --filter name=$IMAGE_NAME)
                            if [ ! -z "$CONTAINER_ID" ]; then
                                echo "コンテナ情報:"
                                docker inspect $CONTAINER_ID | grep -E "State|Error|ExitCode"
                            fi
                            
                            # 一時ファイルを削除
                            rm -f /tmp/firebase-admin-key.json
                            rm -f /tmp/env_vars.sh

                            # コンテナが稼働していない場合はログを取得してからパイプラインを失敗させる
                            if [ -z "$(docker ps -q --filter name=$IMAGE_NAME --filter status=running)" ]; then
                                echo "コンテナが正常に実行されていません。ログを取得します:"
                                docker logs $(docker ps -qa --filter name=$IMAGE_NAME) || echo "ログの取得に失敗しました"
                                echo "コンテナが実行されていないため、パイプラインを失敗させます。"
                                exit 1
                            fi
                        '''
                    }
                }
                echo "ホームサーバーへのデプロイが完了しました"
            }
        }
    }
    
    post {
        always {
            echo "クリーンアップを実行中..."
            sh '''
                # docker-composeで起動したすべてのコンテナを停止・削除
                docker-compose down --remove-orphans || true
                
                # 未使用イメージを削除して領域を解放
                docker image prune -f
                
                # 存在する場合はネットワークを削除
                docker network rm ${DOCKER_NETWORK} || true
            '''
            
            // ワークスペースをクリーンアップ
            cleanWs()
        }
        success {
            echo 'パイプラインが正常に完了しました！'
            withCredentials([string(credentialsId: 'DISCORD_WEBHOOK_JENKINS_LOG_URL', variable: 'DISCORD_WEBHOOK_JENKINS_LOG_URL')]) {
                sh '''
                    # JSONをエスケープして正しく構築
                    JOB_NAME_ESC=$(echo "${JOB_NAME}" | sed 's/"/\\\\"/g')
                    
                    # Discord通知をcurlで送信（ビルド成功）
                    curl -X POST -H "Content-Type: application/json" \\
                         -d "{\\\"content\\\":\\\"**ビルド成功** ✨\\nジョブ: ${JOB_NAME_ESC}\\nビルド番号: #${BUILD_NUMBER}\\\"}" \\
                         "${DISCORD_WEBHOOK_JENKINS_LOG_URL}"
                '''
            }
        }
        failure {
            echo 'パイプラインが失敗しました！'
            withCredentials([string(credentialsId: 'DISCORD_WEBHOOK_JENKINS_LOG_URL', variable: 'DISCORD_WEBHOOK_JENKINS_LOG_URL')]) {
                sh '''
                    # JSONをエスケープして正しく構築
                    JOB_NAME_ESC=$(echo "${JOB_NAME}" | sed 's/"/\\\\"/g')
                    
                    # Discord通知をcurlで送信（ビルド失敗）
                    curl -X POST -H "Content-Type: application/json" \\
                         -d "{\\\"content\\\":\\\"**ビルド失敗** 🚨\\nジョブ: ${JOB_NAME_ESC}\\nビルド番号: #${BUILD_NUMBER}\\\"}" \\
                         "${DISCORD_WEBHOOK_JENKINS_LOG_URL}"
                '''
            }
        }
    }
}
