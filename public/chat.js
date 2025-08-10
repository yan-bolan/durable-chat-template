var downloadfun = function (filekey) {
};

document.addEventListener("DOMContentLoaded", () => {
    // <snippet_Connection>
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chathub")
        .configureLogging(signalR.LogLevel.Information)
        .build();
    // </snippet_Connection>

    // <snippet_ReceiveMessage>
    connection.on("ReceiveMessage", (user, message) => {
        const pre = document.createElement("pre");
        pre.textContent = `${message}`;
        const li = document.createElement("li");
        li.appendChild(pre);
        document.getElementById("messageList").appendChild(li);
        console.log(`Received message from ${user}: ${message}`);
        notifition("msg", message);
    });

    connection.on("ReceiveFile", (item, userName) => {
        var container = document.getElementById("messageList");
        // 生成HTML内容
        var htmlString = `<li><pre class="msg">${item.fileData.filename}; ${item.createTime}<button class="btn btn-primary" onclick="downloadfun('${item.key}')">&nbsp; Download</button></pre ></li>`;
        container.insertAdjacentHTML('beforeend', htmlString);

    });
    
    //https://developer.mozilla.org/zh-CN/docs/Web/API/Notifications_API/Using_the_Notifications_API#%E6%B5%8F%E8%A7%88%E5%99%A8%E5%85%BC%E5%AE%B9%E6%80%A7 写一个通知 使用 js
    function notifition(msgtype) {
        // 检查浏览器是否支持 Notifications API
        if (!("Notification" in window)) {
            console.error("该浏览器不支持桌面通知。");
        } else {
            // 根据当前通知权限来执行不同操作
            if (Notification.permission === "granted") {
                // 如果已经获得授权，直接创建通知
                const notification = new Notification("通知标题", {
                    body: "这是通知的正文内容。",
                    icon: "https://picsum.photos/50" // 可选，替换为你的网站图标 URL
                });
            } else if (Notification.permission !== "denied") {
                // 如果权限未被拒绝，则请求权限
                Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        // 用户同意授权后，创建通知
                        const notification = new Notification("通知标题", {
                            body: "这是通知的正文内容。",
                            icon: "https://picsum.photos/50"
                        });
                    } else {
                        console.warn("通知权限被拒绝。");
                    }
                });
            } else {
                console.warn("通知权限已被拒绝，无法创建通知。");
            }
        }
    }
   // 消息通知
    function notifition(msgtype, message) {
        //if (window.isSecureContext) {
        //    // 页面在安全上下文中， 
        //    // …
        //    console.log("页面在安全上下文中，可以发送消息");
        //} else {
        //    console.log("页面不在安全上下文中，无法发送消息");
        //}
        // 检查浏览器是否支持 Notifications API
        if (!("Notification" in window)) {
            console.error("该浏览器不支持桌面通知。");
        } else {
            // 根据当前通知权限来执行不同操作
            if (Notification.permission === "granted") {
                // 如果已经获得授权，直接创建通知
                const notification = new Notification("有一条新消息，点击复制消息内容", {
                    body: message,
                    icon: "https://picsum.photos/50" //chrome必选，否则不显示， firfox里面可选，替换为你的网站图标 URL
                });

                // 点击通知后复制消息文本
                notification.onclick = () => {
                    navigator.clipboard.writeText(message)
                        .then(() => {
                            console.log('消息已成功复制到剪切板');
                        })
                        .catch(err => {
                            console.error('复制消息到剪切板失败:', err);
                        });
                };
            } else if (Notification.permission !== "denied") {
                // 如果权限未被拒绝，则请求权限
                window.Notification.requestPermission().then(permission => {
                    if (permission === "granted") {
                        // 用户同意授权后，创建通知
                        const notification = new Notification("通知标题", {
                            body: message,
                            icon: "https://picsum.photos/50"
                        });

                        // 点击通知后复制消息文本
                        notification.onclick = () => {
                            navigator.clipboard.writeText(message)
                                .then(() => {
                                    console.log('消息已成功复制到剪切板');
                                })
                                .catch(err => {
                                    console.error('复制消息到剪切板失败:', err);
                                });
                        };
                    } else {
                        console.warn("通知权限被拒绝。");
                    }
                });
            } else {
                console.warn("通知权限已被拒绝，无法创建通知。");
            }
        }
    }
    // </snippet_ReceiveMessage>
//< !--Initialize Quill editor-- >
        const quill = new Quill('#editor', {
            theme: 'snow'
        });
    downloadfun = function (filekey) {
        connection.invoke("Download", filekey);
    }

    connection.on("ReceiveDownloadFile", (fileName, fileBase64) => {
                // Decode base64 string
                // 解码 Base64 数据 
                var base64 = fileBase64.split(',')[1];
                var byteCharacters = atob(base64);
                //const byteCharacters = atob(fileBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: "application/octet-stream" });

                // Create a link and trigger download
                const link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.download = fileName;
                link.click(); 
    });
     
    document.getElementById("send").addEventListener("click", async () => {
        const user = document.getElementById("userInput").value;
        const message = quill.getText();// document.getElementById("messageInput").value;

        // <snippet_Invoke>
        try {
            await connection.invoke("SendMessage", user, message);
        } catch (err) {
            console.error(err);
        }
        // </snippet_Invoke>
    });
    document.getElementById("Browse").addEventListener("click", () => {
        document.getElementById("f").click();
    });

    document.getElementById("f").addEventListener("change", () => {
        var file = document.getElementById("f").files[0];
        handleFile(file);
    });

    const dropZone = document.getElementById("drop-zone");

    dropZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "blue";
    });

    dropZone.addEventListener("dragleave", () => {
        dropZone.style.borderColor = "#ccc";
    });

    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.style.borderColor = "#ccc";
        var file = e.dataTransfer.files[0];
        handleFile(file);
    });

    function handleFile(file) {
        const user = document.getElementById("userInput").value;
        console.log(file.name);
        console.log(file.type);

        var reader = new FileReader();
        reader.onloadend = function () {
            var postdata = {
                Filename: file.name,
                Filetype: file.type,
                data: reader.result
            };
            connection.invoke("Upload", postdata, user);
        };
        reader.readAsDataURL(file);
    }

    async function start() {
        try {
            await connection.start();
            console.log("SignalR Connected.");
        } catch (err) {
            console.log(err);
            setTimeout(start, 5000);
        }
    };

    connection.onclose(async () => {
        await start();
    });

    // Start the connection.
    start();
});
