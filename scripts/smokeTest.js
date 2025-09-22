const http = require('http');

function request(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function post(path, body, token) {
  const opts = {
    hostname: 'localhost',
    port: 5000,
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(JSON.stringify(body || {}))
    }
  };
  if (token) opts.headers.Authorization = 'Bearer ' + token;
  return request(opts, body);
}

async function get(path, token) {
  const opts = {
    hostname: 'localhost',
    port: 5000,
    path,
    method: 'GET',
    headers: {}
  };
  if (token) opts.headers.Authorization = 'Bearer ' + token;
  return request(opts);
}

async function run() {
  try {
    console.log('Starting smoke tests...');

    // 1) Health
    const health = await get('/api/health');
    console.log('HEALTH', health.status, health.body);

    // 2) Login as seeded admin
    const login = await post('/api/auth/login', { login: 'admin@sreerama.ac.in', password: 'Admin@1234' });
    console.log('LOGIN', login.status);
    const parsedLogin = JSON.parse(login.body || '{}');
    if (!parsedLogin.data || !parsedLogin.data.token) {
      console.error('Login failed or no token returned; aborting smoke tests');
      return process.exit(1);
    }
    const token = parsedLogin.data.token;

    const endpoints = [
      { path: '/api/users', name: 'USERS' },
      { path: '/api/users?limit=5', name: 'USERS_PAGED' },
      { path: '/api/timetables', name: 'TIMETABLES' },
      { path: '/api/timetables?limit=5', name: 'TIMETABLES_PAGED' },
      { path: '/api/sessions?limit=5', name: 'SESSIONS' },
      // Reports: attendance summary and export
      { path: '/api/reports/attendance-summary?limit=5', name: 'ATTENDANCE_SUMMARY' },
      { path: '/api/academic-years', name: 'ACADEMIC_YEARS' },
      { path: '/api/reports/export?limit=5', name: 'REPORTS_EXPORT' }
    ];

    for (const ep of endpoints) {
      try {
        const r = await get(ep.path, token);
        console.log(ep.name, r.status);
        if (r.status === 200) {
          try {
            const j = JSON.parse(r.body || '{}');
            // quick checks
            if (j.success === false) console.warn(ep.name, 'returned success:false message=', j.message || j);
            else if (!j.data) console.warn(ep.name, 'no data field in response');
          } catch (e) {
            console.warn(ep.name, 'response is not JSON or parse failed');
          }
        } else {
          console.warn(ep.name, 'non-200 status', r.status, r.body);
        }
      } catch (e) {
        console.error('Error calling', ep.path, e.message);
      }
    }

    // Call admin monthly reports trigger as POST with dryRun flag
    try {
      const adminReport = await post('/api/admin/send-monthly-reports', { dryRun: true }, token);
      console.log('ADMIN_MONTHLY_REPORT_DRYRUN', adminReport.status, adminReport.body);
    } catch (e) {
      console.error('Error calling admin monthly report trigger', e.message);
    }

    console.log('Smoke tests completed');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test runner error', err);
    process.exit(1);
  }
}

if (require.main === module) run();

module.exports = run;
