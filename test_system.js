/**
 * Comprehensive In-Memory System Test Suite
 * Dispatches requests directly to Express without network TCP sockets,
 * guaranteeing 100% reliable execution in sandboxed environments.
 */

const { EventEmitter } = require('events');
const app = require('./src/app');
const db = require('./src/db');
const { seedDatabase } = require('./src/db/seed');

// In-Memory Request / Response mock for Express
function dispatchRequest(method, urlPath, options = {}) {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = urlPath;
    req.originalUrl = urlPath;
    req.headers = {
      'content-type': 'application/json',
      host: 'localhost',
      ...(options.headers || {})
    };
    req.cookies = {};

    // Parse cookie header if present
    if (req.headers.cookie) {
      const parts = req.headers.cookie.split(';');
      for (const p of parts) {
        const [k, v] = p.trim().split('=');
        if (k && v) req.cookies[k] = v;
      }
    }

    req.body = options.body || {};
    req.ip = '127.0.0.1';
    req.connection = { remoteAddress: '127.0.0.1' };
    req.socket = { remoteAddress: '127.0.0.1' };

    const res = new EventEmitter();
    let statusCode = 200;
    const headers = {};
    let bodyData = '';

    res._headers = headers;
    res.statusCode = 200;
    res.setHeader = (name, val) => {
      headers[name.toLowerCase()] = val;
    };
    res.getHeader = (name) => headers[name.toLowerCase()];
    res.get = (name) => headers[name.toLowerCase()];
    res.removeHeader = (name) => {
      delete headers[name.toLowerCase()];
    };
    res.status = (code) => {
      statusCode = code;
      res.statusCode = code;
      return res;
    };
    res.cookie = (name, val, cookieOpts) => {
      const cookieStr = `${name}=${val}; Path=/; HttpOnly`;
      headers['set-cookie'] = headers['set-cookie'] || [];
      headers['set-cookie'].push(cookieStr);
    };
    res.clearCookie = (name) => {
      headers['set-cookie'] = headers['set-cookie'] || [];
      headers['set-cookie'].push(`${name}=; Max-Age=0; Path=/`);
    };

    res.send = (data) => {
      bodyData = data;
      finish();
    };
    res.json = (data) => {
      headers['content-type'] = 'application/json';
      bodyData = JSON.stringify(data);
      finish();
    };
    res.end = (data) => {
      if (data) bodyData = data;
      finish();
    };

    function finish() {
      let parsed = null;
      try {
        parsed = JSON.parse(bodyData);
      } catch {
        parsed = bodyData;
      }

      let cookieToken = null;
      if (headers['set-cookie']) {
        const c = Array.isArray(headers['set-cookie']) ? headers['set-cookie'][0] : headers['set-cookie'];
        const m = c.match(/token=([^;]+)/);
        if (m) cookieToken = m[1];
      }

      resolve({
        status: statusCode,
        headers,
        data: parsed,
        cookie: cookieToken
      });
    }

    // Pass into Express app
    app.handle(req, res);
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('   STARTING FULL SYSTEM VERIFICATION TEST SUITE     ');
  console.log('====================================================');

  await db.initDatabase();
  await seedDatabase(true, true);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: Authentication & Role Verification
    // ----------------------------------------------------
    console.log('\n--- Test Group 1: Authentication & Role Verification ---');

    // Admin login with new credentials (BADAL_12345 / admin dibyansh)
    const adminLogin = await dispatchRequest('POST', '/api/auth/login', {
      body: { email: 'admin', password: 'BADAL_12345' }
    });
    assert(adminLogin.status === 200 && adminLogin.data.user.role === 'ADMIN' && adminLogin.data.user.name === 'admin dibyansh', 'Admin Dibyansh signs in successfully with username alias');
    const adminToken = adminLogin.cookie || adminLogin.data.token;

    // Admin login with full email
    const adminEmailLogin = await dispatchRequest('POST', '/api/auth/login', {
      body: { email: 'admin@videoagency.com', password: 'BADAL_12345' }
    });
    assert(adminEmailLogin.status === 200 && adminEmailLogin.data.user.name === 'admin dibyansh', 'Admin Dibyansh signs in with full email address');

    // Editor login
    const editorLogin = await dispatchRequest('POST', '/api/auth/login', {
      body: { email: 'editor1@videoagency.com', password: 'EditorPass123!' }
    });
    assert(editorLogin.status === 200 && editorLogin.data.user.role === 'EDITOR', 'Editor signs in successfully');
    const editorToken = editorLogin.cookie || editorLogin.data.token;

    // Client login
    const clientLogin = await dispatchRequest('POST', '/api/auth/login', {
      body: { email: 'client1@techflow.io', password: 'ClientPass123!' }
    });
    assert(clientLogin.status === 200 && clientLogin.data.user.role === 'CLIENT', 'Client signs in successfully');
    const clientToken = clientLogin.cookie || clientLogin.data.token;

    // Client Self-Registration
    const clientReg = await dispatchRequest('POST', '/api/auth/register', {
      body: {
        role: 'CLIENT',
        name: 'Sarah Jenkins',
        email: `sarah_${Date.now()}@jenkinsmedia.com`,
        password: 'ClientPassword123!',
        company_name: 'Jenkins Media',
        phone: '+1 (555) 019-2834'
      }
    });
    assert(clientReg.status === 201 && clientReg.data.user.role === 'CLIENT' && clientReg.data.user.profile.company_name === 'Jenkins Media', 'Client self-registration succeeds with company & phone');

    // Editor Self-Registration
    const editorReg = await dispatchRequest('POST', '/api/auth/register', {
      body: {
        role: 'EDITOR',
        name: 'David Ross',
        email: `david_${Date.now()}@rossedits.com`,
        password: 'EditorPassword123!',
        phone: '+1 (555) 234-5678',
        portfolio_link: 'https://vimeo.com/davidross-edits',
        skills: 'Premiere Pro, After Effects, DaVinci Resolve'
      }
    });
    assert(editorReg.status === 201 && editorReg.data.user.role === 'EDITOR' && editorReg.data.user.profile.skills.includes('Premiere'), 'Editor self-registration succeeds with portfolio & tools');

    // Prevent duplicate email registration
    const dupReg = await dispatchRequest('POST', '/api/auth/register', {
      body: {
        role: 'CLIENT',
        name: 'Duplicate Sarah',
        email: clientReg.data.user.email,
        password: 'AnotherPassword123!',
        company_name: 'Jenkins Media',
        phone: '+1 (555) 019-2834'
      }
    });
    assert(dupReg.status === 409, 'Duplicate email registration rejected with 409 Conflict');

    // ----------------------------------------------------
    // TEST 2: Strict Privacy Boundaries & Data Sanitization
    // ----------------------------------------------------
    console.log('\n--- Test Group 2: Privacy Boundaries & Sanitization ---');

    // Editor views projects
    const editorProjects = await dispatchRequest('GET', '/api/projects', {
      headers: { cookie: `token=${editorToken}` }
    });
    assert(editorProjects.status === 200, 'Editor fetches assigned projects');
    const ep0 = editorProjects.data.projects[0];
    assert(ep0 && ep0.client_name === undefined, 'Editor CANNOT see client name');
    assert(ep0 && ep0.client_price === undefined, 'Editor CANNOT see client price');
    assert(ep0 && ep0.client_budget === undefined, 'Editor CANNOT see client budget');
    assert(ep0 && ep0.net_margin === undefined, 'Editor CANNOT see agency profit margin');
    assert(ep0 && ep0.editor_payment !== undefined, 'Editor CAN see agreed editor payout');

    // Client views projects
    const clientProjects = await dispatchRequest('GET', '/api/projects', {
      headers: { cookie: `token=${clientToken}` }
    });
    assert(clientProjects.status === 200, 'Client fetches own projects');
    const cp0 = clientProjects.data.projects[0];
    assert(cp0 && cp0.editor_name === undefined, 'Client CANNOT see editor name');
    assert(cp0 && cp0.editor_email === undefined, 'Client CANNOT see editor email');
    assert(cp0 && cp0.editor_payment === undefined, 'Client CANNOT see editor payout');
    assert(cp0 && cp0.net_margin === undefined, 'Client CANNOT see agency profit margin');
    assert(cp0 && cp0.client_price !== undefined, 'Client CAN see client price');

    // Direct Client <-> Editor Chat Block (Backend 403 Forbidden)
    const clientMsgEditor = await dispatchRequest('POST', '/api/chat/send', {
      headers: { cookie: `token=${clientToken}` },
      body: { receiver_id: 'u-editor-001', message: 'Direct message attempt to editor!' }
    });
    assert(clientMsgEditor.status === 403, 'Direct messaging from Client to Editor is BLOCKED (403 Forbidden)');

    const editorMsgClient = await dispatchRequest('POST', '/api/chat/send', {
      headers: { cookie: `token=${editorToken}` },
      body: { receiver_id: 'u-client-001', message: 'Direct message attempt to client!' }
    });
    assert(editorMsgClient.status === 403, 'Direct messaging from Editor to Client is BLOCKED (403 Forbidden)');

    // Permitted Chat with Admin
    const clientMsgAdmin = await dispatchRequest('POST', '/api/chat/send', {
      headers: { cookie: `token=${clientToken}` },
      body: { receiver_id: 'u-admin-001', message: 'Hello agency admin, please check project status.' }
    });
    assert(clientMsgAdmin.status === 201, 'Client messaging Admin is ALLOWED (201 Created)');

    const editorMsgAdmin = await dispatchRequest('POST', '/api/chat/send', {
      headers: { cookie: `token=${editorToken}` },
      body: { receiver_id: 'u-admin-001', message: 'Hello admin, cut 1 is rendering now.' }
    });
    assert(editorMsgAdmin.status === 201, 'Editor messaging Admin is ALLOWED (201 Created)');

    // Verify Chat Unread Summary Endpoint
    const adminUnread = await dispatchRequest('GET', '/api/chat/unread', {
      headers: { cookie: `token=${adminToken}` }
    });
    assert(adminUnread.status === 200 && adminUnread.data.unread_messages >= 2, 'Admin unread summary returns accurate message count');
    assert(adminUnread.data.unread_senders >= 2, 'Admin unread summary tracks distinct senders count');
    assert(adminUnread.data.by_tab && adminUnread.data.by_tab.clients >= 1 && adminUnread.data.by_tab.editors >= 1, 'Admin unread breakdown segregates clients and editors tabs');

    // Admin opens client conversation to mark messages read
    const readClientChat = await dispatchRequest('GET', '/api/chat/messages/u-client-001', {
      headers: { cookie: `token=${adminToken}` }
    });
    assert(readClientChat.status === 200, 'Admin fetches and marks client messages as read');

    const adminUnreadAfter = await dispatchRequest('GET', '/api/chat/unread', {
      headers: { cookie: `token=${adminToken}` }
    });
    assert(adminUnreadAfter.status === 200 && adminUnreadAfter.data.by_tab.clients === 0, 'Client unread count resets to 0 after conversation is read');

    // ----------------------------------------------------
    // TEST 3: Multi-Currency & Negotiation Workflow
    // ----------------------------------------------------
    console.log('\n--- Test Group 3: Multi-Currency & Negotiation Workflow ---');

    // Client 2 creates a new request in INR
    const client2Login = await dispatchRequest('POST', '/api/auth/login', {
      body: { email: 'client2@apexfitness.com', password: 'ClientPass123!' }
    });
    const client2Token = client2Login.cookie || client2Login.data.token;

    const newReq = await dispatchRequest('POST', '/api/projects', {
      headers: { cookie: `token=${client2Token}` },
      body: {
        title: 'New Winter Collection High-Energy Reel',
        video_type: 'Reels / TikTok',
        currency: 'INR',
        client_budget: 35000.00,
        reference_link: 'https://drive.google.com/drive/folders/test-winter-reel',
        editing_requirements: 'Vertical 9:16 format with dynamic zooms and beat drops'
      }
    });
    assert(newReq.status === 201 && newReq.data.project.status === 'Pending Approval', 'Client creates request in INR with proposed budget');
    const createdProjectId = newReq.data.project.id;

    // Admin reviews, counter-quotes, and assigns editor
    const adminQuote = await dispatchRequest('POST', `/api/projects/${createdProjectId}/quote`, {
      headers: { cookie: `token=${adminToken}` },
      body: {
        client_price: 32000.00,
        admin_quote_note: 'Accepted package price including 3 revisions and color LUT',
        editor_id: 'u-editor-002',
        editor_payment: 18000.00,
        deadline: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        status: 'In Progress'
      }
    });
    assert(adminQuote.status === 200, 'Admin approves counter-quote and assigns editor');

    // Verify Client visibility
    const clientView = await dispatchRequest('GET', `/api/projects/${createdProjectId}`, {
      headers: { cookie: `token=${client2Token}` }
    });
    assert(clientView.data.project.client_price === 32000.00, 'Client sees confirmed price of ₹32,000');
    assert(clientView.data.project.admin_quote_note !== undefined, 'Client sees admin negotiation note');
    assert(clientView.data.project.editor_payment === undefined, 'Client cannot see editor payout');

    // ----------------------------------------------------
    // TEST 4: Editor Cut Submission & Admin Review
    // ----------------------------------------------------
    console.log('\n--- Test Group 4: Cut Submission & Review Workflow ---');

    const editor2Login = await dispatchRequest('POST', '/api/auth/login', {
      body: { email: 'editor2@videoagency.com', password: 'EditorPass123!' }
    });
    const editor2Token = editor2Login.cookie || editor2Login.data.token;

    // Editor submits cut
    const cutSub = await dispatchRequest('POST', `/api/projects/${createdProjectId}/submit`, {
      headers: { cookie: `token=${editor2Token}` },
      body: {
        submission_link: 'https://drive.google.com/file/d/test-cut-v1/view',
        notes: 'First cut completed with music sync'
      }
    });
    assert(cutSub.status === 201, 'Editor submits cut version 1');

    // Admin requests revision
    const reqRevision = await dispatchRequest('POST', `/api/projects/${createdProjectId}/review-cut`, {
      headers: { cookie: `token=${adminToken}` },
      body: {
        action: 'REQUEST_REVISION',
        notes: 'Speed up intro hook by 1.5 seconds and brighten gym floor lighting'
      }
    });
    assert(reqRevision.status === 200, 'Admin requests cut revision with feedback');

    // Editor submits revised cut
    const cutSub2 = await dispatchRequest('POST', `/api/projects/${createdProjectId}/submit`, {
      headers: { cookie: `token=${editor2Token}` },
      body: {
        submission_link: 'https://drive.google.com/file/d/test-cut-v2/view',
        notes: 'Intro trimmed and exposure lifted on shadow areas'
      }
    });
    assert(cutSub2.status === 201, 'Editor submits cut version 2');

    // Admin approves cut
    const approveCut = await dispatchRequest('POST', `/api/projects/${createdProjectId}/review-cut`, {
      headers: { cookie: `token=${adminToken}` },
      body: { action: 'APPROVE' }
    });
    assert(approveCut.status === 200, 'Admin approves editor cut');

    // Admin completes project and delivers master link
    const completeProj = await dispatchRequest('POST', `/api/projects/${createdProjectId}/complete`, {
      headers: { cookie: `token=${adminToken}` },
      body: { final_delivery_link: 'https://drive.google.com/drive/folders/final-masters-winter-reel' }
    });
    assert(completeProj.status === 200, 'Admin marks project completed and delivers master download link');

    // ----------------------------------------------------
    // TEST 5: Financial Ledger & Transactions
    // ----------------------------------------------------
    console.log('\n--- Test Group 5: Finance Ledger & Payments ---');

    // Record Client Payment in INR via UPI
    const pmt1 = await dispatchRequest('POST', '/api/finance/record-payment', {
      headers: { cookie: `token=${adminToken}` },
      body: {
        project_id: createdProjectId,
        type: 'CLIENT_PAYMENT',
        amount: 32000.00,
        currency: 'INR',
        payment_method: 'UPI / GPay / IMPS',
        reference_id: 'UPI-TEST-998822',
        notes: 'Full payment cleared via UPI'
      }
    });
    assert(pmt1.status === 201, 'Admin records client payment via UPI (INR 32,000)');

    // Record Editor Payout in INR via Bank Wire
    const pmt2 = await dispatchRequest('POST', '/api/finance/record-payment', {
      headers: { cookie: `token=${adminToken}` },
      body: {
        project_id: createdProjectId,
        type: 'EDITOR_PAYMENT',
        amount: 18000.00,
        currency: 'INR',
        payment_method: 'Bank Wire / ACH',
        reference_id: 'IMPS-TEST-334411',
        notes: 'Final payout dispatched to editor'
      }
    });
    assert(pmt2.status === 201, 'Admin records editor payout via Bank Wire (INR 18,000)');

    // Check financial ledger
    const ledgerRes = await dispatchRequest('GET', '/api/finance/ledger', {
      headers: { cookie: `token=${adminToken}` }
    });
    assert(ledgerRes.status === 200, 'Admin retrieves financial ledger table');
    const targetRow = ledgerRes.data.ledger.find(r => r.id === createdProjectId);
    assert(targetRow && targetRow.client_payment_status === 'PAID', 'Project marked PAID for client');
    assert(targetRow && targetRow.editor_payment_status === 'PAID', 'Project marked PAID for editor');
    assert(targetRow && targetRow.net_margin === 14000.00, 'Net margin correctly calculated as ₹14,000 (32,000 - 18,000)');

    // ----------------------------------------------------
    // TEST 6: Video Metadata Inspection
    // ----------------------------------------------------
    console.log('\n--- Test Group 6: Video Inspector Service ---');

    const videoInspect = await dispatchRequest('POST', '/api/video/inspect', {
      headers: { cookie: `token=${adminToken}` },
      body: { url: 'https://drive.google.com/file/d/test-footage-4k-prores.mov/view' }
    });
    assert(videoInspect.status === 200, 'Video inspection succeeds');
    const vData = videoInspect.data.data;
    assert(vData && vData.duration_seconds > 0, 'Duration parsed');
    assert(vData && vData.resolution !== undefined, 'Resolution parsed');
    assert(vData && vData.thumbnails && vData.thumbnails.length === 3, 'Keyframe thumbnails generated (10%, 50%, 80%)');

    // ----------------------------------------------------
    // TEST 7: Client Project Deletion & Protection
    // ----------------------------------------------------
    console.log('\n--- Test Group 7: Project Deletion Workflow ---');

    // Client creates an accidental / mistaken project
    const accidentalProject = await dispatchRequest('POST', '/api/projects', {
      headers: { cookie: `token=${clientToken}` },
      body: {
        title: 'Accidental Project Submission',
        video_type: 'Shorts / TikTok',
        currency: 'USD',
        client_budget: 150.00,
        reference_link: 'https://drive.google.com/drive/folders/mistaken-upload'
      }
    });
    assert(accidentalProject.status === 201, 'Client submits accidental project request');
    const accidentalId = accidentalProject.data.project.id;

    // Editor attempts to delete client project -> 403 Forbidden
    const editorDeleteAttempt = await dispatchRequest('DELETE', `/api/projects/${accidentalId}`, {
      headers: { cookie: `token=${editorToken}` }
    });
    assert(editorDeleteAttempt.status === 403, 'Editor deletion of project is BLOCKED (403 Forbidden)');

    // Client deletes their own mistaken project -> 200 OK
    const clientDelete = await dispatchRequest('DELETE', `/api/projects/${accidentalId}`, {
      headers: { cookie: `token=${clientToken}` }
    });
    assert(clientDelete.status === 200, 'Client successfully deletes own mistaken project (200 OK)');

    // Verification: project is gone
    const fetchDeleted = await dispatchRequest('GET', `/api/projects/${accidentalId}`, {
      headers: { cookie: `token=${clientToken}` }
    });
    assert(fetchDeleted.status === 404, 'Deleted project no longer exists in system (404 Not Found)');

    // ----------------------------------------------------
    // TEST 8: Full End-to-End Workflow: Project Editing, Waiting for Editor, Client Revision/Approval, UTR Payment & Deduction
    // ----------------------------------------------------
    console.log('\n--- Test Group 8: Comprehensive 7-Feature Lifecycle Verification ---');

    // 1. Client creates a project with Advance Payment
    const advProject = await dispatchRequest('POST', '/api/projects', {
      headers: { cookie: `token=${clientToken}` },
      body: {
        title: 'Brand Launch Commercial',
        video_type: 'Commercial / Ad',
        currency: 'USD',
        client_budget: 1200.00,
        reference_link: 'https://drive.google.com/drive/folders/brand-footage-raw',
        editing_requirements: 'Cinema grade colors with sound design and SFX',
        advance_payment: {
          amount: 300.00,
          payment_method: 'Stripe / Card',
          reference_id: 'ADV-STRIPE-4421',
          notes: '25% advance payment submitted'
        }
      }
    });
    assert(advProject.status === 201 && advProject.data.project.status === 'Pending Approval', 'Client creates project with Advance Payment (Pending Approval)');
    const advProjectId = advProject.data.project.id;

    // 2. Client edits project while still Pending Approval
    const clientPreEdit = await dispatchRequest('PUT', `/api/projects/${advProjectId}`, {
      headers: { cookie: `token=${clientToken}` },
      body: {
        title: 'Brand Launch Commercial (Updated Requirements)',
        client_budget: 1300.00,
        editing_requirements: 'Updated: include 3 aspect ratio cuts (16:9, 9:16, 1:1)'
      }
    });
    assert(clientPreEdit.status === 200 && clientPreEdit.data.project.title.includes('Updated Requirements'), 'Client successfully edits request while Pending Approval');

    // 3. Admin reviews, quotes, and assigns Kshitiz Singh -> status becomes 'Waiting for Editor'
    const adminQuoteAdv = await dispatchRequest('POST', `/api/projects/${advProjectId}/quote`, {
      headers: { cookie: `token=${adminToken}` },
      body: {
        client_price: 1300.00,
        admin_quote_note: 'Approved with 3 format renders included',
        editor_id: 'u-editor-kshitiz',
        editor_payment: 700.00,
        deadline: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString()
      }
    });
    assert(adminQuoteAdv.status === 200, 'Admin approves and quotes project');
    
    // Verify status is 'Waiting for Editor'
    const checkWaitEditor = await dispatchRequest('GET', `/api/projects/${advProjectId}`, {
      headers: { cookie: `token=${adminToken}` }
    });
    assert(checkWaitEditor.data.project.status === 'Waiting for Editor', 'Project transitions to "Waiting for Editor" state');

    // 4. Client attempts to edit AFTER approval -> must be rejected with 403
    const clientPostEditAttempt = await dispatchRequest('PUT', `/api/projects/${advProjectId}`, {
      headers: { cookie: `token=${clientToken}` },
      body: { title: 'Unauthorized Post-Approval Change' }
    });
    assert(clientPostEditAttempt.status === 403, 'Client edit attempt AFTER Admin approval is blocked (403 Forbidden)');

    // 5. Admin edits project anytime -> must succeed
    const adminEditProject = await dispatchRequest('PUT', `/api/projects/${advProjectId}`, {
      headers: { cookie: `token=${adminToken}` },
      body: { title: 'Brand Launch Commercial (Admin Final Cut Spec)' }
    });
    assert(adminEditProject.status === 200 && adminEditProject.data.project.title.includes('Admin Final Cut Spec'), 'Admin can edit project details anytime (200 OK)');

    // 6. Editor (Kshitiz Singh) logs in and accepts assignment
    const kshitizLogin = await dispatchRequest('POST', '/api/auth/login', {
      body: { email: 'kshitizs780@gmail.com', password: 'BADAL_12345' }
    });
    assert(kshitizLogin.status === 200, 'Editor Kshitiz Singh logs in successfully');
    const kshitizToken = kshitizLogin.cookie || kshitizLogin.data.token;

    const editorAccept = await dispatchRequest('POST', `/api/projects/${advProjectId}/accept-assignment`, {
      headers: { cookie: `token=${kshitizToken}` }
    });
    assert(editorAccept.status === 200, 'Editor accepts assignment ("Accept & Start Working")');

    const checkInProgress = await dispatchRequest('GET', `/api/projects/${advProjectId}`, {
      headers: { cookie: `token=${kshitizToken}` }
    });
    assert(checkInProgress.data.project.status === 'In Progress', 'Project status transitioned to "In Progress"');

    // 7. Editor submits cut
    await dispatchRequest('POST', `/api/projects/${advProjectId}/submit`, {
      headers: { cookie: `token=${kshitizToken}` },
      body: { submission_link: 'https://drive.google.com/file/d/brand-cut-v1/view', notes: 'First assembly' }
    });

    // 8. Admin approves cut & completes delivery
    await dispatchRequest('POST', `/api/projects/${advProjectId}/review-cut`, {
      headers: { cookie: `token=${adminToken}` },
      body: { action: 'APPROVE' }
    });
    await dispatchRequest('POST', `/api/projects/${advProjectId}/complete`, {
      headers: { cookie: `token=${adminToken}` },
      body: { final_delivery_link: 'https://drive.google.com/drive/folders/brand-deliverables-v1' }
    });

    // 9. Client receives edit and requests revision
    const clientRevReq = await dispatchRequest('POST', `/api/projects/${advProjectId}/client-revision`, {
      headers: { cookie: `token=${clientToken}` },
      body: { revision_notes: 'Tone down the bass at 1:15 and adjust end logo framing' }
    });
    assert(clientRevReq.status === 200, 'Client requests delivery revision with notes');

    const checkRevState = await dispatchRequest('GET', `/api/projects/${advProjectId}`, {
      headers: { cookie: `token=${adminToken}` }
    });
    assert(checkRevState.data.project.status === 'Revision Required' && checkRevState.data.project.client_revision_notes.includes('Tone down the bass'), 'Project marked "Revision Required" with client feedback');

    // 10. Client approves revision / final delivery
    const clientApprove = await dispatchRequest('POST', `/api/projects/${advProjectId}/client-approve`, {
      headers: { cookie: `token=${clientToken}` }
    });
    assert(clientApprove.status === 200, 'Client approves delivered video');

    // 11. Client submits final payment with UTR number
    const clientSubmitUtr = await dispatchRequest('POST', `/api/projects/${advProjectId}/submit-payment`, {
      headers: { cookie: `token=${clientToken}` },
      body: {
        amount: 1000.00,
        payment_method: 'Bank Wire / IMPS',
        reference_id: 'UTR-HDFC-99228811',
        receipt_url: 'https://cdn.receipts.com/utr-99228811.pdf',
        notes: 'Final balance paid via RTGS/UTR transfer'
      }
    });
    assert(clientSubmitUtr.status === 201 && clientSubmitUtr.data.payment.status === 'PENDING_VERIFICATION', 'Client submits payment with UTR (status: PENDING_VERIFICATION)');
    const clientPaymentId = clientSubmitUtr.data.payment.id;

    // 12. Admin checks pending verifications & approves client payment
    const adminFinanceView = await dispatchRequest('GET', '/api/finance/overview', {
      headers: { cookie: `token=${adminToken}` }
    });
    assert(adminFinanceView.status === 200, 'Admin fetches financial overview');
    assert(adminFinanceView.data.pendingVerifications && adminFinanceView.data.pendingVerifications.some(p => p.id === clientPaymentId), 'Pending UTR payment visible in Admin verification queue');

    const adminApprovePmt = await dispatchRequest('POST', `/api/finance/payments/${clientPaymentId}/approve`, {
      headers: { cookie: `token=${adminToken}` }
    });
    assert(adminApprovePmt.status === 200, 'Admin verifies and approves client UTR payment');

    // 13. Admin records Editor payment with late penalty / deduction
    const editorPayoutDeduction = await dispatchRequest('POST', '/api/finance/record-payment', {
      headers: { cookie: `token=${adminToken}` },
      body: {
        project_id: advProjectId,
        type: 'EDITOR_PAYMENT',
        amount: 600.00,
        deduction_amount: 100.00,
        deduction_reason: 'Late delivery penalty by 1 day',
        currency: 'USD',
        payment_method: 'Wise / Direct Wire',
        reference_id: 'WISE-PAY-441199',
        notes: 'Agreed $700, deducted $100 penalty, paid $600'
      }
    });
    assert(editorPayoutDeduction.status === 201, 'Admin records editor payout with penalty deduction ($600 paid + $100 deducted)');

    // 14. Verify Project editor payment status is marked PAID with deduction breakdown
    const checkEditorPaidState = await dispatchRequest('GET', `/api/projects/${advProjectId}`, {
      headers: { cookie: `token=${adminToken}` }
    });
    const projDetail = checkEditorPaidState.data.project;
    assert(projDetail.editor_payment_status === 'PAID', 'Project editor payment status evaluated as PAID');
    assert(projDetail.editor_deduction_amount === 100.00, 'Editor deduction amount recorded as $100.00');

    // 15. Verify Multi-Period Profit & Loss Hub
    const finOverview = await dispatchRequest('GET', '/api/finance/overview', {
      headers: { cookie: `token=${adminToken}` }
    });
    assert(finOverview.data.periods !== undefined, 'Financial overview returns multi-period analysis');
    assert(finOverview.data.periods.day !== undefined, 'Profit/Loss includes Day (1D) interval');
    assert(finOverview.data.periods.week !== undefined, 'Profit/Loss includes Week (7D) interval');
    assert(finOverview.data.periods.month !== undefined, 'Profit/Loss includes Month (30D) interval');
    assert(finOverview.data.periods.year !== undefined, 'Profit/Loss includes Year (1Y) interval');
    assert(finOverview.data.periods.three_year !== undefined, 'Profit/Loss includes 3 Years (3Y) interval');
    assert(finOverview.data.periods.all !== undefined, 'Profit/Loss includes All Time interval');
    assert(finOverview.data.periods.all.USD.net_profit_loss !== undefined, 'Net profit/loss calculated for USD');
    assert(finOverview.data.periods.all.INR.net_profit_loss !== undefined, 'Net profit/loss calculated for INR');

    // ----------------------------------------------------
    // SUMMARY
    // ----------------------------------------------------
    console.log('\n====================================================');
    console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

  } catch (err) {
    console.error('Unhandled error during test suite:', err);
    failed++;
  } finally {
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
