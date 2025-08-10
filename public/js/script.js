document.getElementById('messageForm').addEventListener('submit', function (e) {
    e.preventDefault(); // 阻止表单默认提交行为  

    const input = document.getElementById('messageInput2');
    const message = input.value.trim();

    if (message) {
        // 创建一个新的消息元素  
        const messageElement = document.createElement('div');
        messageElement.classList.add('message');
        messageElement.textContent = message;

        // 将新消息添加到消息容器中  
        const messagesContainer = document.querySelector('.messages');
        messagesContainer.appendChild(messageElement);

        // 清空输入框  
        input.value = '';

        // 滚动到最新消息  
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
});