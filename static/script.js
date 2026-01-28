const API_BASE_URL = window.location.origin; // Используем тот же origin, что и у фронтенда

class TimerDashboard {
    constructor() {
        this.events = [];
        this.charts = {};
        this.currentUser = null;
        this.currentPeriod = 'month';
        this.DateTime = luxon.DateTime;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateCurrentDate();
        this.checkAuthStatus();
    }

    setupEventListeners() {
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        document.getElementById('periodSelect').addEventListener('change', (e) => {
            this.currentPeriod = e.target.value;
            if (e.target.value === 'custom') {
                document.getElementById('customDateRange').style.display = 'flex';
            } else {
                document.getElementById('customDateRange').style.display = 'none';
                this.loadData();
            }
        });
        
        document.getElementById('applyDateRange').addEventListener('click', () => this.loadData());
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabId = e.target.dataset.tab;
                this.switchTab(tabId);
            });
        });
        
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                this.filterEvents(type);
            });
        });
        
        // Обработка Enter в полях ввода при логине
        document.getElementById('password').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });
    }

    updateCurrentDate() {
        const now = this.DateTime.now().setLocale('ru').toLocaleString(this.DateTime.DATE_FULL);
        document.getElementById('currentDate').textContent = now;
    }

    async checkAuthStatus() {
        try {
            const response = await fetch(`${API_BASE_URL}/me`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentUser = data[0]?.username || 'Пользователь';
                this.showDashboard();
                this.events = data;
                this.processData();
            } else {
                this.showAuth();
            }
        } catch (error) {
            console.error('Ошибка проверки авторизации:', error);
            this.showAuth();
        }
    }

    async login() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        
        if (!username || !password) {
            this.showError('Введите имя пользователя и пароль');
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'username': username,
                    'passwd': password,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                this.currentUser = username;
                this.showDashboard();
                this.loadData();
            } else {
                this.showError('Неверные учетные данные');
            }
        } catch (error) {
            console.error('Ошибка входа:', error);
            this.showError('Ошибка соединения с сервером');
        }
    }

    logout() {
        document.cookie = "session_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
        this.showAuth();
        this.clearDashboard();
    }

    showAuth() {
        document.getElementById('authContainer').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }

    showDashboard() {
        document.getElementById('authContainer').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        document.title = `Dashboard - ${this.currentUser}`;
    }

    clearDashboard() {
        this.events = [];
        Object.values(this.charts).forEach(chart => chart.destroy());
        this.charts = {};
    }

    showError(message) {
        const errorEl = document.getElementById('loginError');
        errorEl.textContent = message;
        setTimeout(() => errorEl.textContent = '', 3000);
    }

    async loadData() {
        try {
            const response = await fetch(`${API_BASE_URL}/me`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                this.events = data;
                this.processData();
            } else {
                this.showAuth();
            }
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
        }
    }

    processData() {
        if (!this.events || this.events.length === 0) {
            this.showNoData();
            return;
        }

        this.calculateStatistics();
        this.createCharts();
        this.updateDetailedStats();
        this.renderEvents();
    }

    calculateStatistics() {
        const sessions = this.reconstructSessions();
        
        // Общее время работы
        const totalWorkTime = sessions.reduce((sum, session) => sum + session.duration, 0);
        const totalHours = Math.floor(totalWorkTime / 60);
        const totalMinutes = Math.round(totalWorkTime % 60);
        document.getElementById('totalWorkTime').textContent = `${totalHours}ч ${totalMinutes}м`;
        
        // Всего ошибок
        const totalMistakes = this.events.filter(e => e.type === 'misstake').length;
        document.getElementById('totalMistakes').textContent = totalMistakes;
        
        // Средняя продолжительность сессии
        const avgSessionTime = sessions.length > 0 ? totalWorkTime / sessions.length : 0;
        const avgHours = Math.floor(avgSessionTime / 60);
        const avgMinutes = Math.round(avgSessionTime % 60);
        document.getElementById('avgSessionTime').textContent = `${avgHours}ч ${avgMinutes}м`;
        
        // Эффективность (время работы / (время работы + ошибки * 2 минуты))
        const penaltyTime = totalMistakes * 2;
        const efficiency = totalWorkTime > 0 ? 
            Math.round((totalWorkTime / (totalWorkTime + penaltyTime)) * 100) : 0;
        document.getElementById('efficiency').textContent = `${efficiency}%`;
    }

    reconstructSessions() {
        const sessions = [];
        let currentSession = null;
        
        // Сортируем события по времени
        const sortedEvents = [...this.events].sort((a, b) => 
            new Date(a.time) - new Date(b.time)
        );
        
        for (const event of sortedEvents) {
            const eventTime = this.DateTime.fromISO(event.time);
            
            if (event.type === 'start') {
                if (currentSession) {
                    // Завершаем предыдущую сессию
                    currentSession.end = eventTime;
                    sessions.push(currentSession);
                }
                currentSession = {
                    start: eventTime,
                    end: null,
                    mistakes: 0
                };
            } else if (event.type === 'stop' && currentSession) {
                currentSession.end = eventTime;
                sessions.push(currentSession);
                currentSession = null;
            } else if (event.type === 'misstake' && currentSession) {
                currentSession.mistakes++;
            }
        }
        
        // Если есть незавершенная сессия
        if (currentSession && currentSession.start) {
            currentSession.end = this.DateTime.now();
            sessions.push(currentSession);
        }
        
        // Рассчитываем продолжительность каждой сессии в минутах
        sessions.forEach(session => {
            session.duration = session.end.diff(session.start, 'minutes').minutes;
            // Вычитаем штрафное время за ошибки
            session.duration -= session.mistakes * 2;
            if (session.duration < 0) session.duration = 0;
        });
        
        return sessions;
    }

    createCharts() {
        this.createDailyChart();
        this.createTypeDistributionChart();
        this.createTimelineChart();
        this.createHourlyChart();
        this.createTrendChart();
    }

    createDailyChart() {
        const ctx = document.getElementById('dailyChart').getContext('2d');
        
        // Группируем данные по дням
        const dailyData = {};
        this.events.forEach(event => {
            const date = this.DateTime.fromISO(event.time).toISODate();
            if (!dailyData[date]) {
                dailyData[date] = { work: 0, mistakes: 0 };
            }
        });
        
        // Рассчитываем время работы по дням
        const sessions = this.reconstructSessions();
        sessions.forEach(session => {
            const date = session.start.toISODate();
            if (dailyData[date]) {
                dailyData[date].work += session.duration;
            }
        });
        
        // Подсчитываем ошибки по дням
        this.events.forEach(event => {
            if (event.type === 'misstake') {
                const date = this.DateTime.fromISO(event.time).toISODate();
                if (dailyData[date]) {
                    dailyData[date].mistakes++;
                }
            }
        });
        
        const labels = Object.keys(dailyData).sort();
        const workData = labels.map(date => Math.round(dailyData[date].work / 60 * 10) / 10); // в часах
        const mistakesData = labels.map(date => dailyData[date].mistakes);
        
        if (this.charts.dailyChart) {
            this.charts.dailyChart.destroy();
        }
        
        this.charts.dailyChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels.map(date => this.formatDate(date)),
                datasets: [
                    {
                        label: 'Время работы (часы)',
                        data: workData,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Ошибки',
                        data: mistakesData,
                        type: 'line',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Часы работы'
                        }
                    },
                    y1: {
                        position: 'right',
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Количество ошибок'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Работа и ошибки по дням'
                    }
                }
            }
        });
    }

    createTypeDistributionChart() {
        const ctx = document.getElementById('typeDistributionChart').getContext('2d');
        
        const typeCounts = {
            start: this.events.filter(e => e.type === 'start').length,
            stop: this.events.filter(e => e.type === 'stop').length,
            misstake: this.events.filter(e => e.type === 'misstake').length
        };
        
        if (this.charts.typeDistributionChart) {
            this.charts.typeDistributionChart.destroy();
        }
        
        this.charts.typeDistributionChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Старт', 'Стоп', 'Ошибки'],
                datasets: [{
                    data: [typeCounts.start, typeCounts.stop, typeCounts.misstake],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.5)',
                        'rgba(255, 159, 64, 0.5)',
                        'rgba(255, 99, 132, 0.5)'
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Распределение по типам событий'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((context.raw / total) * 100);
                                return `${context.label}: ${context.raw} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    createTimelineChart() {
        const ctx = document.getElementById('timelineChart').getContext('2d');
        const sessions = this.reconstructSessions();
        
        const labels = sessions.map((_, i) => `Сессия ${i + 1}`);
        const durations = sessions.map(s => Math.round(s.duration));
        const efficiencies = sessions.map(s => {
            const totalTime = s.duration + (s.mistakes * 2);
            return totalTime > 0 ? Math.round((s.duration / totalTime) * 100) : 0;
        });
        
        if (this.charts.timelineChart) {
            this.charts.timelineChart.destroy();
        }
        
        this.charts.timelineChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Длительность (мин)',
                        data: durations,
                        backgroundColor: 'rgba(54, 162, 235, 0.5)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Эффективность (%)',
                        data: efficiencies,
                        type: 'line',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 2,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Сессии'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Длительность (минуты)'
                        }
                    },
                    y1: {
                        position: 'right',
                        beginAtZero: true,
                        max: 100,
                        title: {
                            display: true,
                            text: 'Эффективность (%)'
                        },
                        grid: {
                            drawOnChartArea: false
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'История сессий'
                    }
                }
            }
        });
    }

    createHourlyChart() {
        const ctx = document.getElementById('hourlyChart').getContext('2d');
        
        // Группируем по часам
        const hourlyData = Array(24).fill(0);
        const hourlyMistakes = Array(24).fill(0);
        
        this.events.forEach(event => {
            const hour = this.DateTime.fromISO(event.time).hour;
            if (event.type === 'start' || event.type === 'stop') {
                hourlyData[hour]++;
            } else if (event.type === 'misstake') {
                hourlyMistakes[hour]++;
            }
        });
        
        const labels = Array.from({length: 24}, (_, i) => `${i}:00`);
        
        if (this.charts.hourlyChart) {
            this.charts.hourlyChart.destroy();
        }
        
        this.charts.hourlyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Активность',
                        data: hourlyData,
                        borderColor: 'rgba(75, 192, 192, 1)',
                        backgroundColor: 'rgba(75, 192, 192, 0.1)',
                        borderWidth: 2,
                        fill: true
                    },
                    {
                        label: 'Ошибки',
                        data: hourlyMistakes,
                        borderColor: 'rgba(255, 99, 132, 1)',
                        backgroundColor: 'rgba(255, 99, 132, 0.1)',
                        borderWidth: 2,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Час дня'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Количество событий'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Активность по времени суток'
                    }
                }
            }
        });
    }

    createTrendChart() {
        const ctx = document.getElementById('trendChart').getContext('2d');
        
        // Группируем по неделям
        const weeklyData = {};
        this.events.forEach(event => {
            const week = this.DateTime.fromISO(event.time).weekNumber;
            const year = this.DateTime.fromISO(event.time).year;
            const key = `${year}-W${week.toString().padStart(2, '0')}`;
            
            if (!weeklyData[key]) {
                weeklyData[key] = { work: 0, mistakes: 0 };
            }
        });
        
        // Рассчитываем данные по неделям
        const sessions = this.reconstructSessions();
        sessions.forEach(session => {
            const week = session.start.weekNumber;
            const year = session.start.year;
            const key = `${year}-W${week.toString().padStart(2, '0')}`;
            
            if (weeklyData[key]) {
                weeklyData[key].work += session.duration;
            }
        });
        
        // Ошибки по неделям
        this.events.forEach(event => {
            if (event.type === 'misstake') {
                const week = this.DateTime.fromISO(event.time).weekNumber;
                const year = this.DateTime.fromISO(event.time).year;
                const key = `${year}-W${week.toString().padStart(2, '0')}`;
                
                if (weeklyData[key]) {
                    weeklyData[key].mistakes++;
                }
            }
        });
        
        const labels = Object.keys(weeklyData).sort();
        const workTrend = labels.map(key => weeklyData[key].work / 60); // в часах
        const efficiencyTrend = labels.map(key => {
            const penaltyTime = weeklyData[key].mistakes * 2;
            const totalTime = weeklyData[key].work + penaltyTime;
            return totalTime > 0 ? Math.round((weeklyData[key].work / totalTime) * 100) : 0;
        });
        
        if (this.charts.trendChart) {
            this.charts.trendChart.destroy();
        }
        
        this.charts.trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Время работы (часы)',
                        data: workTrend,
                        borderColor: 'rgba(54, 162, 235, 1)',
                        backgroundColor: 'rgba(54, 162, 235, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Эффективность (%)',
                        data: efficiencyTrend,
                        borderColor: 'rgba(255, 159, 64, 1)',
                        backgroundColor: 'rgba(255, 159, 64, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Неделя'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Показатели'
                        }
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Тенденции по неделям'
                    }
                }
            }
        });
    }

    updateDetailedStats() {
        this.updateDailyStats();
        this.updateWeeklyStats();
        this.updateMonthlyStats();
    }

    updateDailyStats() {
        const tbody = document.querySelector('#dailyStatsTable tbody');
        tbody.innerHTML = '';
        
        const dailyStats = {};
        
        // Группируем по дням
        this.events.forEach(event => {
            const date = this.DateTime.fromISO(event.time).toISODate();
            if (!dailyStats[date]) {
                dailyStats[date] = {
                    work: 0,
                    sessions: 0,
                    mistakes: 0,
                    efficiency: 0
                };
            }
        });
        
        // Рассчитываем статистику
        const sessions = this.reconstructSessions();
        sessions.forEach(session => {
            const date = session.start.toISODate();
            if (dailyStats[date]) {
                dailyStats[date].work += session.duration;
                dailyStats[date].sessions++;
                dailyStats[date].mistakes += session.mistakes;
            }
        });
        
        // Рассчитываем эффективность
        Object.keys(dailyStats).forEach(date => {
            const penaltyTime = dailyStats[date].mistakes * 2;
            const totalTime = dailyStats[date].work + penaltyTime;
            dailyStats[date].efficiency = totalTime > 0 ? 
                Math.round((dailyStats[date].work / totalTime) * 100) : 0;
        });
        
        // Сортируем по дате
        const sortedDates = Object.keys(dailyStats).sort().reverse();
        
        sortedDates.forEach(date => {
            const stats = dailyStats[date];
            const workHours = Math.floor(stats.work / 60);
            const workMinutes = Math.round(stats.work % 60);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${this.formatDate(date)}</td>
                <td>${workHours}ч ${workMinutes}м</td>
                <td>${stats.sessions}</td>
                <td>${stats.mistakes}</td>
                <td>${stats.efficiency}%</td>
            `;
            tbody.appendChild(row);
        });
    }

    updateWeeklyStats() {
        const tbody = document.querySelector('#weeklyStatsTable tbody');
        tbody.innerHTML = '';
        
        const weeklyStats = {};
        
        this.events.forEach(event => {
            const week = this.DateTime.fromISO(event.time).weekNumber;
            const year = this.DateTime.fromISO(event.time).year;
            const key = `${year}-W${week.toString().padStart(2, '0')}`;
            
            if (!weeklyStats[key]) {
                weeklyStats[key] = {
                    work: 0,
                    sessions: 0,
                    mistakes: 0,
                    efficiency: 0
                };
            }
        });
        
        const sessions = this.reconstructSessions();
        sessions.forEach(session => {
            const week = session.start.weekNumber;
            const year = session.start.year;
            const key = `${year}-W${week.toString().padStart(2, '0')}`;
            
            if (weeklyStats[key]) {
                weeklyStats[key].work += session.duration;
                weeklyStats[key].sessions++;
                weeklyStats[key].mistakes += session.mistakes;
            }
        });
        
        // Рассчитываем среднюю эффективность
        Object.keys(weeklyStats).forEach(key => {
            const penaltyTime = weeklyStats[key].mistakes * 2;
            const totalTime = weeklyStats[key].work + penaltyTime;
            weeklyStats[key].efficiency = totalTime > 0 ? 
                Math.round((weeklyStats[key].work / totalTime) * 100) : 0;
        });
        
        const sortedWeeks = Object.keys(weeklyStats).sort().reverse();
        
        sortedWeeks.forEach(key => {
            const stats = weeklyStats[key];
            const workHours = Math.floor(stats.work / 60);
            const workMinutes = Math.round(stats.work % 60);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${key}</td>
                <td>${workHours}ч ${workMinutes}м</td>
                <td>${stats.sessions}</td>
                <td>${stats.mistakes}</td>
                <td>${stats.efficiency}%</td>
            `;
            tbody.appendChild(row);
        });
    }

    updateMonthlyStats() {
        const tbody = document.querySelector('#monthlyStatsTable tbody');
        tbody.innerHTML = '';
        
        const monthlyStats = {};
        
        this.events.forEach(event => {
            const month = this.DateTime.fromISO(event.time).month;
            const year = this.DateTime.fromISO(event.time).year;
            const key = `${year}-${month.toString().padStart(2, '0')}`;
            
            if (!monthlyStats[key]) {
                monthlyStats[key] = {
                    work: 0,
                    sessions: 0,
                    mistakes: 0,
                    efficiency: 0
                };
            }
        });
        
        const sessions = this.reconstructSessions();
        sessions.forEach(session => {
            const month = session.start.month;
            const year = session.start.year;
            const key = `${year}-${month.toString().padStart(2, '0')}`;
            
            if (monthlyStats[key]) {
                monthlyStats[key].work += session.duration;
                monthlyStats[key].sessions++;
                monthlyStats[key].mistakes += session.mistakes;
            }
        });
        
        // Рассчитываем среднюю эффективность
        Object.keys(monthlyStats).forEach(key => {
            const penaltyTime = monthlyStats[key].mistakes * 2;
            const totalTime = monthlyStats[key].work + penaltyTime;
            monthlyStats[key].efficiency = totalTime > 0 ? 
                Math.round((monthlyStats[key].work / totalTime) * 100) : 0;
        });
        
        const sortedMonths = Object.keys(monthlyStats).sort().reverse();
        
        sortedMonths.forEach(key => {
            const [year, month] = key.split('-');
            const stats = monthlyStats[key];
            const workHours = Math.floor(stats.work / 60);
            const workMinutes = Math.round(stats.work % 60);
            
            const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                               'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${monthNames[parseInt(month) - 1]} ${year}</td>
                <td>${workHours}ч ${workMinutes}м</td>
                <td>${stats.sessions}</td>
                <td>${stats.mistakes}</td>
                <td>${stats.efficiency}%</td>
            `;
            tbody.appendChild(row);
        });
    }

    renderEvents() {
        const container = document.getElementById('eventsContainer');
        container.innerHTML = '';
        
        // Сортируем события по времени (новые сверху)
        const sortedEvents = [...this.events].sort((a, b) => 
            new Date(b.time) - new Date(a.time)
        ).slice(0, 20); // Показываем только последние 20 событий
        
        sortedEvents.forEach(event => {
            const eventEl = document.createElement('div');
            eventEl.className = 'event-item';
            eventEl.dataset.type = event.type;
            
            const typeText = {
                'start': 'Старт',
                'stop': 'Стоп',
                'misstake': 'Ошибка'
            };
            
            const typeColors = {
                'start': 'success-color',
                'stop': 'warning-color',
                'misstake': 'danger-color'
            };
            
            eventEl.innerHTML = `
                <div class="event-type ${event.type}">
                    ${event.type === 'start' ? '▶' : event.type === 'stop' ? '⏸' : '⚠'}
                </div>
                <div class="event-content">
                    <strong>${typeText[event.type] || event.type}</strong>
                    <div class="event-time">${this.formatDateTime(event.time)}</div>
                </div>
            `;
            
            container.appendChild(eventEl);
        });
    }

    filterEvents(type) {
        const events = document.querySelectorAll('.event-item');
        const buttons = document.querySelectorAll('.filter-btn');
        
        // Обновляем активную кнопку
        buttons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.type === type);
        });
        
        // Фильтруем события
        events.forEach(event => {
            if (type === 'all' || event.dataset.type === type) {
                event.style.display = 'flex';
            } else {
                event.style.display = 'none';
            }
        });
    }

    switchTab(tabId) {
        // Обновляем активные вкладки
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });
        
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });
    }

    formatDate(dateString) {
        return this.DateTime.fromISO(dateString).setLocale('ru').toLocaleString(this.DateTime.DATE_MED);
    }

    formatDateTime(dateTimeString) {
        return this.DateTime.fromISO(dateTimeString).setLocale('ru').toLocaleString(this.DateTime.DATETIME_MED);
    }

    showNoData() {
        const container = document.getElementById('eventsContainer');
        container.innerHTML = `
            <div class="loading">
                <div class="spinner"></div>
                <p>Нет данных для отображения</p>
            </div>
        `;
    }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.timerDashboard = new TimerDashboard();
});