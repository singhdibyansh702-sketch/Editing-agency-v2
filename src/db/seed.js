const bcrypt = require('bcryptjs');
const db = require('./index');

async function seedDatabase(force = false, isTest = false) {
  try {
    // Ensure database is initialized before querying
    await db.initDatabase();

    const adminHash = await bcrypt.hash('BADAL_12345', 10);
    const adminId = 'u-admin-001';

    // 1. Purge legacy demo users and demo data
    const demoEmails = [
      'editor1@videoagency.com',
      'editor2@videoagency.com',
      'client1@techflow.io',
      'client2@apexfitness.com'
    ];

    if (!isTest || force) {
      console.log('[Seed] Purging legacy demo accounts and demo data...');
      try {
        await db.query(`DELETE FROM users WHERE email IN ('editor1@videoagency.com', 'editor2@videoagency.com', 'client1@techflow.io', 'client2@apexfitness.com') OR id IN ('u-editor-001', 'u-editor-002', 'u-client-001', 'u-client-002')`);
        await db.query(`DELETE FROM client_profiles WHERE id IN ('cp-001', 'cp-002') OR user_id IN ('u-client-001', 'u-client-002')`);
        await db.query(`DELETE FROM editor_profiles WHERE id IN ('ep-001', 'ep-002') OR user_id IN ('u-editor-001', 'u-editor-002')`);
        await db.query(`DELETE FROM payments WHERE project_id IN ('prj-001', 'prj-002', 'prj-003', 'prj-004')`);
        await db.query(`DELETE FROM project_submissions WHERE project_id IN ('prj-001', 'prj-002', 'prj-003', 'prj-004')`);
        await db.query(`DELETE FROM direct_messages WHERE sender_id IN ('u-editor-001', 'u-editor-002', 'u-client-001', 'u-client-002') OR receiver_id IN ('u-editor-001', 'u-editor-002', 'u-client-001', 'u-client-002')`);
        await db.query(`DELETE FROM projects WHERE id IN ('prj-001', 'prj-002', 'prj-003', 'prj-004')`);
      } catch (purgeErr) {
        console.warn('[Seed] Warning during demo cleanup:', purgeErr.message);
      }
    }

    // 2. Ensure Admin Dibyansh is provisioned with password BADAL_12345
    const [existingAdmins] = await db.query('SELECT * FROM users WHERE role = "ADMIN" OR email = "admin@videoagency.com" OR id = ? LIMIT 1', [adminId]);

    if (existingAdmins && existingAdmins.length > 0) {
      await db.query(
        'UPDATE users SET name = ?, email = ?, password_hash = ?, status = "ACTIVE" WHERE id = ?',
        ['admin dibyansh', 'admin@videoagency.com', adminHash, existingAdmins[0].id]
      );
      console.log(`[Seed] Administrator updated to "admin dibyansh" with new credentials.`);
    } else {
      await db.query(
        'INSERT INTO users (id, email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        [adminId, 'admin@videoagency.com', adminHash, 'admin dibyansh', 'ADMIN', 'ACTIVE']
      );
      console.log('[Seed] Admin "admin dibyansh" provisioned successfully.');
    }

    // 3. Ensure Kshitiz Singh (Editor) is permanently preserved across deployments
    const [existingKshitiz] = await db.query('SELECT * FROM users WHERE email = "kshitizs780@gmail.com" LIMIT 1');
    const kshitizHash = await bcrypt.hash('BADAL_12345', 10);
    const kshitizId = 'u-editor-kshitiz';

    if (!existingKshitiz || existingKshitiz.length === 0) {
      await db.query(
        'INSERT INTO users (id, email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        [kshitizId, 'kshitizs780@gmail.com', kshitizHash, 'Kshitiz Singh', 'EDITOR', 'ACTIVE']
      );
      await db.query(
        'INSERT INTO editor_profiles (id, user_id, phone, skills, experience, portfolio_link, payment_rate, internal_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['ep-kshitiz', kshitizId, '+919470437531', 'AFTER EFFECTS & PREMIER PRO', 'Professional Video Editor', 'https://iameditor.my.canva.site/', 0.00, 'Permanent editor account']
      );
      console.log('[Seed] Editor "Kshitiz Singh" permanently provisioned.');
    } else {
      // Keep password updated to BADAL_12345
      await db.query(
        'UPDATE users SET password_hash = ?, status = "ACTIVE" WHERE email = "kshitizs780@gmail.com"',
        [kshitizHash]
      );
    }

    // 4. Ensure demo 1 (Editor) is permanently preserved across deployments
    const [existingDemo1] = await db.query('SELECT * FROM users WHERE email = "demo1@gmail.com" LIMIT 1');
    const demo1Hash = await bcrypt.hash('BADAL_12345', 10);
    const demo1Id = 'u-editor-demo1';

    if (!existingDemo1 || existingDemo1.length === 0) {
      await db.query(
        'INSERT INTO users (id, email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        [demo1Id, 'demo1@gmail.com', demo1Hash, 'demo 1', 'EDITOR', 'ACTIVE']
      );
      await db.query(
        'INSERT INTO editor_profiles (id, user_id, phone, skills, experience, portfolio_link, payment_rate, internal_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        ['ep-demo1', demo1Id, '7977824229', 'capcut', 'Self-registered editor', 'https://docs.google.com/videos/d/1AZO6MMZzaqSopXy82mZYxvYSb13t0NhqEbhwxRUlCGk/edit?scene=id.p#scene=id.p', 0.00, 'Demo 1 editor account']
      );
      console.log('[Seed] Editor "demo 1" permanently provisioned.');
    } else {
      await db.query(
        'UPDATE users SET password_hash = ?, status = "ACTIVE" WHERE email = "demo1@gmail.com"',
        [demo1Hash]
      );
    }

    // 5. Ensure demo 2 (Client) is permanently preserved across deployments
    const [existingDemo2] = await db.query('SELECT * FROM users WHERE email = "demo2@gmail.com" LIMIT 1');
    const demo2Hash = await bcrypt.hash('BADAL_12345', 10);
    const demo2Id = 'u-client-demo2';

    if (!existingDemo2 || existingDemo2.length === 0) {
      await db.query(
        'INSERT INTO users (id, email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        [demo2Id, 'demo2@gmail.com', demo2Hash, 'demo 2', 'CLIENT', 'ACTIVE']
      );
      await db.query(
        'INSERT INTO client_profiles (id, user_id, phone, company_name, notes) VALUES (?, ?, ?, ?, ?)',
        ['cp-demo2', demo2Id, '28920202', 'demo', 'Self-registered client']
      );
      console.log('[Seed] Client "demo 2" permanently provisioned.');
    } else {
      await db.query(
        'UPDATE users SET password_hash = ?, status = "ACTIVE" WHERE email = "demo2@gmail.com"',
        [demo2Hash]
      );
    }

    // If not in automated test mode, stop here: production stays clean!
    if (!isTest) {
      console.log('[Seed] Production database ready. All accounts synchronized.');
      return;
    }

    // ----------------------------------------------------
    // TEST RUNNER ONLY (isTest = true)
    // ----------------------------------------------------
    const editorHash = await bcrypt.hash('EditorPass123!', 10);
    const clientHash = await bcrypt.hash('ClientPass123!', 10);

    const editor1Id = 'u-editor-001';
    const editor2Id = 'u-editor-002';
    const client1Id = 'u-client-001';
    const client2Id = 'u-client-002';

    const testUsers = [
      [editor1Id, 'editor1@videoagency.com', editorHash, 'Liam Vance', 'EDITOR', 'ACTIVE'],
      [editor2Id, 'editor2@videoagency.com', editorHash, 'Sophia Ray', 'EDITOR', 'ACTIVE'],
      [client1Id, 'client1@techflow.io', clientHash, 'Marcus Brody', 'CLIENT', 'ACTIVE'],
      [client2Id, 'client2@apexfitness.com', clientHash, 'Elena Vance', 'CLIENT', 'ACTIVE'],
    ];

    for (const u of testUsers) {
      await db.query(
        'INSERT INTO users (id, email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        u
      );
    }

    await db.query(
      'INSERT INTO client_profiles (id, user_id, phone, company_name, notes) VALUES (?, ?, ?, ?, ?)',
      ['cp-001', client1Id, '+1 (555) 234-5678', 'TechFlow Media', 'High-growth tech SaaS and developer review channel. Bi-weekly releases.']
    );
    await db.query(
      'INSERT INTO client_profiles (id, user_id, phone, company_name, notes) VALUES (?, ?, ?, ?, ?)',
      ['cp-002', client2Id, '+1 (555) 876-5432', 'Apex Athletics', 'Performance fitness brand. High demand for vertical reels and fast-paced brand spots.']
    );

    await db.query(
      'INSERT INTO editor_profiles (id, user_id, phone, skills, experience, portfolio_link, payment_rate, internal_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'ep-001',
        editor1Id,
        '+1 (555) 444-1122',
        'Premiere Pro, After Effects, DaVinci Resolve, Motion Design, Sound Mixing',
        '6+ Years, Lead YouTube & Motion Specialist',
        'https://vimeo.com/liamvance-edits',
        45.00,
        'Top tier motion design, fast turnaround, exceptional pacing.'
      ]
    );
    await db.query(
      'INSERT INTO editor_profiles (id, user_id, phone, skills, experience, portfolio_link, payment_rate, internal_notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        'ep-002',
        editor2Id,
        '+1 (555) 444-2233',
        'Final Cut Pro, Premiere Pro, Color Grading, TikTok/Reels Pacing, Subtitles',
        '4 Years, Commercial & Short-Form Specialist',
        'https://behance.net/sophiaray_edits',
        35.00,
        'Expert in viral short-form retention, hooks, dynamic captions and audio sync.'
      ]
    );

    const testProjects = [
      [
        'prj-001',
        'PRJ-1001',
        'TechFlow AI Assistant SaaS Showcase (4K)',
        'High-energy product overview highlighting automated multi-agent features, slick UI zooms, and custom sound design.',
        'SaaS Showcase',
        'Include 3D camera tracker titles, subtle sound fx on interface clicks, 4K Rec.709 color grade.',
        'https://drive.google.com/drive/folders/1aBcDeFgHiJkLmNoPqRsTuVwXyZ',
        'https://docs.google.com/document/d/1tEChFlOw-sPec-dOc',
        'USD',
        750.00,
        700.00,
        'Budget negotiated; includes 2 revision rounds and 4K color grade',
        client1Id,
        editor1Id,
        350.00,
        'In Progress',
        new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        null
      ],
      [
        'prj-002',
        'PRJ-1002',
        'Apex Athletics Summer Launch Commercial & 3x Reels',
        'Brand film for gym wear launch plus 3 high-impact vertical cutdowns for Instagram & TikTok.',
        'Commercial',
        'Fast rhythmic cuts to the beat, heavy bass drops, bold typography, speed ramps on athlete sprints.',
        'https://drive.google.com/drive/folders/2bCdEfGhIjKlMnOpQrStUvWxYz',
        'https://docs.google.com/document/d/2aPexAthletics-Commercial-Brief',
        'INR',
        45000.00,
        42000.00,
        'Special package rate confirmed for 60s main master cut + 3 distinct vertical reels',
        client2Id,
        editor2Id,
        22000.00,
        'Submitted for Review',
        new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        null
      ],
      [
        'prj-003',
        'PRJ-1003',
        'NextGen Cloud Architecture YouTube Explainer',
        'Comprehensive 12-minute deep-dive breakdown of modern serverless infrastructure.',
        'YouTube Explainer',
        'Clean animated diagrams, lower thirds, engaging retention b-roll, high retention chapter cuts.',
        'https://drive.google.com/drive/folders/3cDeFgHiJkLmNoPqRsTuVwXyZa',
        'https://docs.google.com/document/d/3cNextGenBrief',
        'USD',
        500.00,
        500.00,
        'Agreed as quoted with final ProRes 422 delivery',
        client1Id,
        editor1Id,
        260.00,
        'Completed',
        new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        'https://drive.google.com/drive/folders/1NextGenCloudFinalDeliveryMasters'
      ],
      [
        'prj-004',
        'PRJ-1004',
        'High-Intensity Hybrid Training Masterclass Module 1',
        'First episode of 5-part training course for elite athletes with voiceover and dual camera angles.',
        'Documentary',
        'Maintain natural skin tones, smooth audio leveling between two lavalier mics, clean chapter title cards.',
        'https://drive.google.com/drive/folders/4dEfGhIjKlMnOpQrStUvWxYzb',
        'https://docs.google.com/document/d/4dMasterclassBrief',
        'INR',
        28000.00,
        0.00,
        null,
        client2Id,
        null,
        0.00,
        'Pending Approval',
        new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '),
        null,
        null
      ]
    ];

    for (const p of testProjects) {
      await db.query(
        `INSERT INTO projects (
          id, project_code, title, description, video_type, editing_requirements,
          reference_link, spec_doc_url, currency, client_budget, client_price,
          admin_quote_note, client_id, editor_id, editor_payment, status,
          deadline, start_date, final_delivery_link
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        p
      );
    }

    await db.query(
      `INSERT INTO project_submissions (id, project_id, editor_id, submission_link, notes, version, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'sub-001',
        'prj-002',
        editor2Id,
        'https://drive.google.com/file/d/1_Apex_Summer_Cut1_Master/view',
        'Rough cut 1 complete! Main 60s film and 3 vertical cuts uploaded with audio mix at -14 LUFS. Please review intro pacing.',
        1,
        'PENDING_REVIEW'
      ]
    );

    const payments = [
      ['pmt-001', 'prj-001', 'CLIENT_PAYMENT', 350.00, 'USD', 'Stripe', new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '), 'ch_3N1aBcDeFgHiJkLm', '50% upfront deposit'],
      ['pmt-002', 'prj-002', 'CLIENT_PAYMENT', 42000.00, 'INR', 'UPI / GPay / IMPS', new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '), 'UPI-8849201948', 'Full payment received upfront via UPI'],
      ['pmt-003', 'prj-002', 'EDITOR_PAYMENT', 10000.00, 'INR', 'Bank Wire / ACH', new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '), 'IMPS-77492100', 'Partial milestone payout to Sophia Ray'],
      ['pmt-004', 'prj-003', 'CLIENT_PAYMENT', 500.00, 'USD', 'PayPal', new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '), 'PP-9948201', 'Paid in full on project booking'],
      ['pmt-005', 'prj-003', 'EDITOR_PAYMENT', 260.00, 'USD', 'Wise', new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' '), 'WISE-112849', 'Final payout settled for PRJ-1003']
    ];

    for (const pmt of payments) {
      await db.query(
        'INSERT INTO payments (id, project_id, type, amount, currency, payment_method, payment_date, reference_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        pmt
      );
    }

    const messages = [
      [
        'msg-001',
        client1Id,
        adminId,
        'prj-001',
        'Hi Admin! Just uploaded the raw footage for the AI Assistant showcase. Can we ensure the intro hook has that crisp 3D UI tracker zoom?',
        1,
        new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
      ],
      [
        'msg-002',
        adminId,
        client1Id,
        'prj-001',
        'Hey Marcus! Absolutely. The spec doc is confirmed and our motion team is already setting up the 3D title trackers.',
        1,
        new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
      ],
      [
        'msg-003',
        editor2Id,
        adminId,
        'prj-002',
        'Hey Admin, Cut 1 for the Apex Athletics Commercial is ready and submitted in the portal.',
        1,
        new Date(Date.now() - 12 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
      ],
      [
        'msg-004',
        adminId,
        editor2Id,
        'prj-002',
        'Reviewing now Sophia! Pacing looks fantastic, loving the beat drops.',
        0,
        new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
      ]
    ];

    for (const m of messages) {
      await db.query(
        'INSERT INTO direct_messages (id, sender_id, receiver_id, project_id, message, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        m
      );
    }

    console.log('[Seed] Test runner fixture records populated.');
  } catch (err) {
    console.error('[Seed] Error seeding database:', err);
  }
}

module.exports = { seedDatabase };
