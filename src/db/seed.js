const bcrypt = require('bcryptjs');
const db = require('./index');

async function seedDatabase(force = false) {
  try {
    // Ensure database is initialized before querying
    await db.initDatabase();

    // Check if users table already has records
    const [existingUsers] = await db.query('SELECT COUNT(*) as count FROM users');
    const userCount = existingUsers && existingUsers[0] ? (existingUsers[0].count || existingUsers[0]['COUNT(*)']) : 0;
    
    if (userCount > 0 && !force) {
      console.log(`[Seed] Database already contains ${userCount} users. Skipping seeder.`);
      return;
    }

    if (force) {
      console.log('[Seed] Resetting database tables for fresh seeding...');
      await db.query('DELETE FROM payments');
      await db.query('DELETE FROM project_submissions');
      await db.query('DELETE FROM direct_messages');
      await db.query('DELETE FROM notifications');
      await db.query('DELETE FROM audit_logs');
      await db.query('DELETE FROM projects');
      await db.query('DELETE FROM client_profiles');
      await db.query('DELETE FROM editor_profiles');
      await db.query('DELETE FROM users');
    }

    console.log('[Seed] Seeding database with realistic demo records...');

    // Password hashes
    const adminHash = await bcrypt.hash('AdminPassword123!', 10);
    const editorHash = await bcrypt.hash('EditorPass123!', 10);
    const clientHash = await bcrypt.hash('ClientPass123!', 10);

    // User IDs
    const adminId = 'u-admin-001';
    const editor1Id = 'u-editor-001';
    const editor2Id = 'u-editor-002';
    const client1Id = 'u-client-001';
    const client2Id = 'u-client-002';

    // 1. Insert Users
    const users = [
      [adminId, 'admin@videoagency.com', adminHash, 'Alex Vance (Agency Owner)', 'ADMIN', 'ACTIVE'],
      [editor1Id, 'editor1@videoagency.com', editorHash, 'Liam Vance', 'EDITOR', 'ACTIVE'],
      [editor2Id, 'editor2@videoagency.com', editorHash, 'Sophia Ray', 'EDITOR', 'ACTIVE'],
      [client1Id, 'client1@techflow.io', clientHash, 'Marcus Brody', 'CLIENT', 'ACTIVE'],
      [client2Id, 'client2@apexfitness.com', clientHash, 'Elena Vance', 'CLIENT', 'ACTIVE'],
    ];

    for (const u of users) {
      await db.query(
        'INSERT INTO users (id, email, password_hash, name, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        u
      );
    }

    // 2. Insert Client Profiles
    await db.query(
      'INSERT INTO client_profiles (id, user_id, phone, company_name, notes) VALUES (?, ?, ?, ?, ?)',
      ['cp-001', client1Id, '+1 (555) 234-5678', 'TechFlow Media', 'High-growth tech SaaS and developer review channel. Bi-weekly releases.']
    );
    await db.query(
      'INSERT INTO client_profiles (id, user_id, phone, company_name, notes) VALUES (?, ?, ?, ?, ?)',
      ['cp-002', client2Id, '+1 (555) 876-5432', 'Apex Athletics', 'Performance fitness brand. High demand for vertical reels and fast-paced brand spots.']
    );

    // 3. Insert Editor Profiles
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

    // 4. Insert Projects
    const projects = [
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

    for (const p of projects) {
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

    // 5. Insert Submissions
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

    // 6. Insert Payments
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

    // 7. Insert Direct Messages (Client <-> Admin, Editor <-> Admin ONLY)
    const messages = [
      // Client 1 <-> Admin
      [
        'msg-001',
        client1Id,
        adminId,
        'prj-001',
        'Hi Alex! Just uploaded the raw footage for the AI Assistant showcase. Can we ensure the intro hook has that crisp 3D UI tracker zoom?',
        1,
        new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
      ],
      [
        'msg-002',
        adminId,
        client1Id,
        'prj-001',
        'Hey Marcus! Absolutely. The spec doc is confirmed and our motion team is already setting up the 3D title trackers. We are right on schedule for the Friday preview.',
        1,
        new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
      ],
      // Editor 2 <-> Admin
      [
        'msg-003',
        editor2Id,
        adminId,
        'prj-002',
        'Hey Alex, Cut 1 for the Apex Athletics Commercial is ready and submitted in the portal. Please review the color grading on the gym floor shots!',
        1,
        new Date(Date.now() - 12 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ')
      ],
      [
        'msg-004',
        adminId,
        editor2Id,
        'prj-002',
        'Reviewing now Sophia! Pacing looks fantastic, loving the beat drops. I will give you final feedback shortly.',
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

    // 8. Insert Notifications
    const notifications = [
      ['ntf-001', adminId, 'New Project Request', 'Elena Vance submitted request "High-Intensity Hybrid Training Masterclass Module 1" (₹28,000 proposed budget).', '/#projects', 0, 'PROJECT_REQUEST'],
      ['ntf-002', adminId, 'New Cut Submitted', 'Editor submitted Cut 1 for "Apex Athletics Summer Launch Commercial & 3x Reels".', '/#projects', 0, 'SUBMISSION'],
      ['ntf-003', editor1Id, 'New Project Assigned', 'You have been assigned to project "TechFlow AI Assistant SaaS Showcase (4K)". Agreed payout: $350.00.', '/#projects', 1, 'ASSIGNMENT'],
      ['ntf-004', client1Id, 'Quote Approved', 'Your project "TechFlow AI Assistant SaaS Showcase (4K)" has been approved and moved to In Progress.', '/#projects', 1, 'PROJECT_UPDATE']
    ];

    for (const n of notifications) {
      await db.query(
        'INSERT INTO notifications (id, user_id, title, message, link, is_read, type) VALUES (?, ?, ?, ?, ?, ?, ?)',
        n
      );
    }

    // 9. Insert Audit Logs
    const auditLogs = [
      ['aud-001', adminId, 'PROJECT_QUOTE_APPROVED', 'PROJECT', 'prj-001', 'Approved quote of $700.00 for PRJ-1001 and assigned editor Liam Vance with $350.00 payout.', '127.0.0.1'],
      ['aud-002', adminId, 'PAYMENT_RECORDED', 'PAYMENT', 'pmt-002', 'Recorded client payment of ₹42,000.00 via UPI / GPay for PRJ-1002.', '127.0.0.1'],
      ['aud-003', editor2Id, 'CUT_SUBMITTED', 'PROJECT_SUBMISSION', 'sub-001', 'Submitted Version 1 cut link for review on PRJ-1002.', '127.0.0.1'],
      ['aud-004', adminId, 'PROJECT_COMPLETED', 'PROJECT', 'prj-003', 'Marked PRJ-1003 Completed and delivered final download links to client Marcus Brody.', '127.0.0.1']
    ];

    for (const a of auditLogs) {
      await db.query(
        'INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?)',
        a
      );
    }

    console.log('[Seed] Realistic demo records successfully populated!');
  } catch (err) {
    console.error('[Seed] Error seeding database:', err);
  }
}

module.exports = { seedDatabase };
