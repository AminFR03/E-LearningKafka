const API_URL = 'http://localhost:3000/api';
let currentUser = null;
let allCoursesCache = [];
let enrolledCoursesCache = [];

/* =========================================================
   UI NAVIGATION & TABS
========================================================= */

function switchAuthTab(tab) {
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab === 'login');
    document.getElementById('tab-login').classList.toggle('active-tab', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active-tab', tab === 'register');
    document.getElementById('auth-status').innerText = '';
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if (type === 'success') icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-times-circle';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function renderSidebar() {
    const nav = document.getElementById('nav-links');
    nav.innerHTML = '';
    
    const links = [];
    if (currentUser.role === 'student') {
        links.push({ icon: 'fa-chart-pie', text: 'My Dashboard', view: 'student-overview' });
        links.push({ icon: 'fa-compass', text: 'Browse Courses', view: 'student-browse' });
    } else {
        links.push({ icon: 'fa-chart-pie', text: 'Professor Dashboard', view: 'prof-overview' });
        links.push({ icon: 'fa-laptop-code', text: 'Authoring Studio', view: 'prof-studio' });
    }

    links.forEach((link, idx) => {
        const li = document.createElement('li');
        li.className = `nav-item ${idx === 0 ? 'active' : ''}`;
        li.innerHTML = `<i class="fa-solid ${link.icon}"></i> ${link.text}`;
        li.onclick = () => switchView(link.view, li);
        nav.appendChild(li);
    });
}

function switchView(viewId, navElement) {
    document.querySelectorAll('.view-section').forEach(el => {
        el.classList.add('hidden');
        el.classList.remove('active');
    });
    
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.remove('hidden');
        view.classList.add('active');
    }

    if (navElement) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        navElement.classList.add('active');
    }
}

function handleUserLogin() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app-layout').classList.remove('hidden');
    
    document.getElementById('user-name-display').innerText = currentUser.name;
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=3b82f6&color=fff`;

    renderSidebar();

    if (currentUser.role === 'student') {
        switchView('student-overview');
        fetchAndRenderStudentData();
    } else if (currentUser.role === 'professor') {
        switchView('prof-overview');
        fetchAndRenderProfData();
    }
}

function logout() {
    currentUser = null;
    enrolledCoursesCache = [];
    allCoursesCache = [];
    document.getElementById('app-layout').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    switchAuthTab('login');
}


/* =========================================================
   AUTH LOGIC (Identical Kafka backend bindings)
========================================================= */

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const statusEl = document.getElementById('auth-status');
    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connecting...';
    try {
        const response = await fetch(`${API_URL}/users/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        if (response.ok) {
            currentUser = await response.json();
            handleUserLogin();
            showToast('Welcome back, ' + currentUser.name + '!', 'success');
        } else {
            statusEl.innerText = 'User not found. Please register.';
        }
    } catch (err) {
        statusEl.innerText = 'Server Error. Is the backend running?';
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const role = document.getElementById('reg-role').value;
    const statusEl = document.getElementById('auth-status');
    statusEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Registering...';
    try {
        const response = await fetch(`${API_URL}/users/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, role })
        });
        if (response.ok) {
            currentUser = await response.json();
            handleUserLogin();
            showToast('Account created! Your Kafka consumer is online.', 'success');
        } else {
            statusEl.innerText = 'Email already exists. Try logging in.';
        }
    } catch (err) {
        statusEl.innerText = 'Server Error. Is the backend running?';
    }
});


/* =========================================================
   STUDENT ACTIONS
========================================================= */

async function fetchAndRenderStudentData() {
    try {
        // Fetch all courses
        const coursesRes = await fetch(`${API_URL}/courses`);
        allCoursesCache = await coursesRes.json();

        // Fetch this student's enrolled courses
        const enrollRes = await fetch(`${API_URL}/enrollments/${currentUser.id}`);
        enrolledCoursesCache = await enrollRes.json();
        const enrolledIds = enrolledCoursesCache.map(c => c.id);

        // --- Render Active Enrolled Courses ---
        const activeGrid = document.getElementById('student-active-courses');
        activeGrid.innerHTML = '';
        document.getElementById('stat-enrolled-count').innerText = enrolledCoursesCache.length;

        if (enrolledCoursesCache.length === 0) {
            activeGrid.innerHTML = '<p style="color:var(--text-muted);">You are not enrolled in any courses yet. Head to <strong>Browse Courses</strong> to get started!</p>';
        }

        enrolledCoursesCache.forEach(course => {
            const progress = Math.floor(Math.random() * 80) + 5; // Mock progress
            const card = document.createElement('div');
            card.className = 'course-card';
            card.innerHTML = `
                <div class="card-body">
                    <h4>${course.title} <span class="tag tag-blue">Enrolled</span></h4>
                    <p>${course.description}</p>
                    <div class="progress-container">
                        <div class="progress-text"><span>Course Progress</span> <span>${progress}%</span></div>
                        <div class="progress-bar"><div class="progress-fill" style="width: ${progress}%;"></div></div>
                    </div>
                    <button class="btn-primary w-full">Continue Learning <i class="fa-solid fa-play"></i></button>
                </div>
            `;
            activeGrid.appendChild(card);
        });

        // --- Render Browse Catalog ---
        const catalogGrid = document.getElementById('student-catalog');
        catalogGrid.innerHTML = '';

        const icons = ['fa-laptop-code', 'fa-database', 'fa-network-wired', 'fa-cloud', 'fa-shield-halved'];

        allCoursesCache.forEach(course => {
            const isEnrolled = enrolledIds.includes(course.id);
            const randomIcon = icons[course.id % icons.length];

            const card = document.createElement('div');
            card.className = 'course-card';
            card.innerHTML = `
                <div class="card-img"><i class="fa-solid ${randomIcon}"></i></div>
                <div class="card-body">
                    <h4>${course.title}</h4>
                    <p>${course.description}</p>
                    ${isEnrolled 
                        ? `<button class="btn-enrolled w-full" disabled><i class="fa-solid fa-circle-check"></i> Already Enrolled</button>` 
                        : `<button class="btn-secondary w-full" onclick="enroll(${course.id})">Enroll & Subscribe <i class="fa-solid fa-bolt"></i></button>`
                    }
                </div>
            `;
            catalogGrid.appendChild(card);
        });

    } catch (err) { console.error(err); }
}

async function enroll(courseId) {
    try {
        const res = await fetch(`${API_URL}/courses/enroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser.id, courseId })
        });
        const data = await res.json();
        if (data.message === 'Already enrolled') {
            showToast('You are already enrolled in this course.', 'info');
            return;
        }
        showToast('Enrolled! A confirmation email has been sent to ' + currentUser.email, 'success');
        
        // Re-fetch everything to update both views
        fetchAndRenderStudentData();

    } catch (err) {
        showToast('Enrollment failed.', 'error');
    }
}


/* =========================================================
   PROFESSOR ACTIONS
========================================================= */

async function fetchAndRenderProfData() {
    try {
        const response = await fetch(`${API_URL}/courses`);
        allCoursesCache = await response.json();
        
        document.getElementById('prof-course-count').innerText = allCoursesCache.length;

        const activeGrid = document.getElementById('prof-active-courses');
        activeGrid.innerHTML = '';
        
        const select = document.getElementById('update-course-select');
        select.innerHTML = '<option value="" disabled selected>Select a course to interact with...</option>';

        allCoursesCache.forEach(course => {
            const card = document.createElement('div');
            card.className = 'course-card';
            card.innerHTML = `
                <div class="card-body">
                    <h4>${course.title}</h4>
                    <p>${course.description}</p>
                    <div class="card-footer">
                        <span class="tag tag-green"><i class="fa-solid fa-circle-check"></i> Topic <code>course-${course.id}</code></span>
                    </div>
                </div>
            `;
            activeGrid.appendChild(card);

            const option = document.createElement('option');
            option.value = course.id;
            option.textContent = `[ID: ${course.id}] ${course.title}`;
            select.appendChild(option);
        });
    } catch (err) { console.error(err); }
}

document.getElementById('form-create-course').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('new-course-title').value;
    const description = document.getElementById('new-course-desc').value;

    const btn = e.target.querySelector('button');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

    try {
        const response = await fetch(`${API_URL}/courses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        const data = await response.json();
        btn.innerHTML = 'Publish to Kafka <i class="fa-solid fa-rocket"></i>';
        showToast(`Topic 'course-${data.course.id}' has been created in Kafka!`, 'success');
        document.getElementById('form-create-course').reset();
        fetchAndRenderProfData();
    } catch (err) {
        btn.innerHTML = 'Publish to Kafka <i class="fa-solid fa-rocket"></i>';
        showToast('Failed to create course.', 'error');
    }
});

document.getElementById('form-update-course').addEventListener('submit', async (e) => {
    e.preventDefault();
    const courseId = document.getElementById('update-course-select').value;
    const title = document.getElementById('update-course-title').value;
    const description = document.getElementById('update-course-desc').value;

    if (!courseId) return showToast('Please select a course to update.', 'error');
    
    const btn = e.target.querySelector('button');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Dispatching...';

    try {
        await fetch(`${API_URL}/courses/${courseId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description })
        });
        btn.innerHTML = 'Dispatch Event <i class="fa-solid fa-paper-plane"></i>';
        showToast(`Update event dispatched to 'course-${courseId}'! Enrolled students will be emailed.`, 'success');
        document.getElementById('form-update-course').reset();
        fetchAndRenderProfData();
    } catch (err) {
        btn.innerHTML = 'Dispatch Event <i class="fa-solid fa-paper-plane"></i>';
        showToast('Failed to dispatch event.', 'error');
    }
});
