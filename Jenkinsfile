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
        stage('Notification') {
            steps {
                echo 'パイプラインの実行を開始しました'
                withCredentials([string(credentialsId: 'DISCORD_WEBHOOK_JENKINS_LOG_URL', variable: 'DISCORD_WEBHOOK_JENKINS_LOG_URL')]) {
                    sh '''
                        # JSONをエスケープして正しく構築
                        JOB_NAME_ESC=$(echo "${JOB_NAME}" | sed 's/"/\\\\"/g')
                        
                        # Discord通知をcurlで送信（ビルド開始）
                        curl -X POST -H "Content-Type: application/json" \\
                             -d "{\\\"content\\\":\\\"**Jenkinsがビルドを受け付けました** 🚀\\nジョブ: ${JOB_NAME_ESC}\\nビルド番号: #${BUILD_NUMBER}\\\"}" \\
                             "${DISCORD_WEBHOOK_JENKINS_LOG_URL}"
                    '''
                }
            }
        }

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
                docker build -t ${IMAGE_NAME}:latest .
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
                        '''
                        
                        def imapServer = sh(script: 'echo "$IMAP_SERVER"', returnStdout: true).trim()
                        def imapUser = sh(script: 'echo "$IMAP_USER"', returnStdout: true).trim()
                        def imapPassword = sh(script: 'echo "$IMAP_PASSWORD"', returnStdout: true).trim()
                        def discordWebhookUrl = sh(script: 'echo "$DISCORD_WEBHOOK_URL"', returnStdout: true).trim()
                        def dockerHubUser = env.DOCKER_HUB_CREDS_USR
                        def imageName = env.IMAGE_NAME
                        
                        sshCommand remote: [
                            name: 'Home Server',
                            host: env.DEPLOY_HOST,
                            user: env.DEPLOY_USER,
                            identityFile: SSH_KEY,
                            port: 22,
                            allowAnyHosts: true,
                            timeout: 60
                        ], command: """
                            # 最新イメージをプル
                            docker pull ${dockerHubUser}/${imageName}:latest
                            
                            # 現在稼働中のコンテナ情報を保存（バックアップ用）
                            CURRENT_CONTAINER=\$(docker ps -q --filter name=${imageName} --filter status=running)
                            CURRENT_CONTAINER_IMAGE=""
                            RUNNING_PORT3000=\$(docker ps -q --filter publish=3000)
                            
                            # 現在稼働中コンテナの情報をログに記録
                            if [ ! -z "\$CURRENT_CONTAINER" ]; then
                                echo "現在稼働中のコンテナを発見: \$CURRENT_CONTAINER"
                                CURRENT_CONTAINER_IMAGE=\$(docker inspect --format='{{.Config.Image}}' \$CURRENT_CONTAINER)
                                echo "現在のイメージ: \$CURRENT_CONTAINER_IMAGE"
                            fi
                            
                            # 既存のバックアップコンテナを確認
                            BACKUP_COUNT=\$(docker ps -a --filter name=${imageName}-backup --format="{{.Names}}" | wc -l)
                            echo "既存のバックアップコンテナ数: \$BACKUP_COUNT"
                            
                            # 一時的なコンテナ名
                            TEMP_CONTAINER_NAME="${imageName}-new-\$(date +%s)"
                            
                            # 一時的なコンテナを起動してテスト（ポート3001で）
                            echo "新しいコンテナを一時的にポート3001で起動してテスト中..."
                            DEPLOY_SUCCESS=false
                            
                            # 一時的なテストコンテナを起動
                            docker run -d --name \$TEMP_CONTAINER_NAME -p 3001:3000 \\
                            -e IMAP_SERVER='${imapServer}' \\
                            -e IMAP_USER='${imapUser}' \\
                            -e IMAP_PASSWORD='${imapPassword}' \\
                            -e DISCORD_WEBHOOK_URL='${discordWebhookUrl}' \\
                            -e GOOGLE_APPLICATION_CREDENTIALS='/usr/src/app/firebase-admin-key.json' \\
                            -v /tmp/firebase-admin-key.json:/usr/src/app/firebase-admin-key.json \\
                            ${dockerHubUser}/${imageName}:latest
                            
                            # 起動待機
                            sleep 10
                            
                            # 稼働チェック
                            if docker ps -q --filter name=\$TEMP_CONTAINER_NAME --filter status=running | grep -q .; then
                                echo "テストコンテナは正常に起動しています"
                                DEPLOY_SUCCESS=true
                                
                                # 既存コンテナを停止して入れ替え
                                if [ ! -z "\$RUNNING_PORT3000" ]; then
                                    echo "ポート3000で稼働中のコンテナを停止します: \$RUNNING_PORT3000"
                                    # タイムスタンプを含むバックアップ名を生成
                                    BACKUP_NAME="${imageName}-backup-\$(date +%s)"
                                    echo "バックアップ名: \$BACKUP_NAME"
                                    
                                    # リネームして保持（バックアップ用）
                                    docker rename \$(docker ps -q --filter publish=3000) \$BACKUP_NAME || true
                                    docker stop \$BACKUP_NAME || true
                                    
                                    # 古いバックアップコンテナの削除（最新のバックアップは残す）
                                    if [ \$BACKUP_COUNT -ge 1 ]; then
                                        echo "古いバックアップを削除します"
                                        # 新しく作ったバックアップを除く全バックアップを取得
                                        OLD_BACKUPS=\$(docker ps -a --filter name=${imageName}-backup --filter status=exited --format="{{.Names}}" | grep -v \$BACKUP_NAME)
                                        if [ ! -z "\$OLD_BACKUPS" ]; then
                                            echo "\$OLD_BACKUPS" | xargs docker rm -f
                                            echo "古いバックアップコンテナを削除しました"
                                        fi
                                    fi
                                fi
                                
                                # テストコンテナを停止
                                docker stop \$TEMP_CONTAINER_NAME || true
                                docker rm \$TEMP_CONTAINER_NAME || true
                                
                                # 本番コンテナを起動
                                docker run -d --name ${imageName} -p 3000:3000 \\
                                -e IMAP_SERVER='${imapServer}' \\
                                -e IMAP_USER='${imapUser}' \\
                                -e IMAP_PASSWORD='${imapPassword}' \\
                                -e DISCORD_WEBHOOK_URL='${discordWebhookUrl}' \\
                                -e GOOGLE_APPLICATION_CREDENTIALS='/usr/src/app/firebase-admin-key.json' \\
                                -v /tmp/firebase-admin-key.json:/usr/src/app/firebase-admin-key.json \\
                                ${dockerHubUser}/${imageName}:latest
                                
                                # 起動待機
                                sleep 5
                                
                                # 最終確認
                                if [ -z "\$(docker ps -q --filter name=${imageName} --filter status=running)" ]; then
                                    echo "本番コンテナの起動に失敗しました。バックアップを復元します"
                                    DEPLOY_SUCCESS=false
                                    
                                    # 古いバックアップを復元
                                    if [ ! -z "\$CURRENT_CONTAINER_IMAGE" ]; then
                                        echo "バックアップから復元中..."
                                        # 起動に失敗したコンテナを削除
                                        docker rm -f ${imageName} || true
                                        
                                        # バックアップコンテナを復元
                                        BACKUP_CONTAINER=\$(docker ps -aq --filter name=${imageName}-backup --filter status=exited | head -1)
                                        if [ ! -z "\$BACKUP_CONTAINER" ]; then
                                            docker rename \$BACKUP_CONTAINER ${imageName} || true
                                            docker start ${imageName} || true
                                            echo "バックアップコンテナを復元しました"
                                        else
                                            echo "バックアップコンテナが見つからないため、イメージから再起動します"
                                            docker run -d --name ${imageName} -p 3000:3000 \\
                                            -e IMAP_SERVER='${imapServer}' \\
                                            -e IMAP_USER='${imapUser}' \\
                                            -e IMAP_PASSWORD='${imapPassword}' \\
                                            -e DISCORD_WEBHOOK_URL='${discordWebhookUrl}' \\
                                            -e GOOGLE_APPLICATION_CREDENTIALS='/usr/src/app/firebase-admin-key.json' \\
                                            -v /tmp/firebase-admin-key.json:/usr/src/app/firebase-admin-key.json \\
                                            \$CURRENT_CONTAINER_IMAGE
                                        fi
                                    fi
                                else
                                    echo "新しいコンテナが正常に起動しました"
                                    
                                    # バックアップの状況をログに出力
                                    echo "現在のバックアップ状況:"
                                    docker ps -a --filter name=${imageName}-backup --format "表 {{.Names}}: {{.Status}}"
                                fi
                            else
                                echo "テストコンテナの起動に失敗しました"
                                docker logs \$TEMP_CONTAINER_NAME || echo "ログの取得に失敗"
                                docker rm -f \$TEMP_CONTAINER_NAME || true
                            fi
                            
                            # 一時ファイルを削除
                            rm -f /tmp/firebase-admin-key.json
                            
                            # デプロイ結果の確認
                            docker ps | grep ${imageName}
                            
                            # コンテナの詳細情報を表示
                            CONTAINER_ID=\$(docker ps -qa --filter name=${imageName})
                            if [ ! -z "\$CONTAINER_ID" ]; then
                                echo "コンテナ情報:"
                                docker inspect \$CONTAINER_ID | grep -E "State|Error|ExitCode"
                            fi
                            
                            # デプロイ結果のステータスに基づいてパイプラインの成否を決定
                            if [ "\$DEPLOY_SUCCESS" = false ] || [ -z "\$(docker ps -q --filter name=${imageName} --filter status=running)" ]; then
                                echo "デプロイに失敗しました。コンテナログを確認:"
                                docker logs \$(docker ps -qa --filter name=${imageName}) || echo "ログの取得に失敗しました"
                                echo "デプロイが失敗しました。パイプラインを終了します。"
                                exit 1
                            else
                                echo "デプロイに成功しました！"
                            fi
                        """
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
