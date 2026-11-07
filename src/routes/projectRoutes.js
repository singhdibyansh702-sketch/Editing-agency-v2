const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { authenticate, requireAdmin, requireEditor } = require('../middleware/auth');

// All project routes require authentication
router.use(authenticate);

// View projects (role-scoped & sanitized)
router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProjectById);

// Create project (Client or Admin)
router.post('/', projectController.createProject);

// Admin Quote & Editor Assignment & Counter-Negotiation
router.post('/:id/quote', requireAdmin, projectController.reviewAndQuoteProject);

// Editor Work Submission (Drive link & notes)
router.post('/:id/submit', requireEditor, projectController.submitCut);

// Admin Review Editor Cut (Approve or Request Revision)
router.post('/:id/review-cut', requireAdmin, projectController.reviewCut);

// Admin Mark Completed & Final Deliverables
router.post('/:id/complete', requireAdmin, projectController.completeProject);

// Admin Cancel Project
router.post('/:id/cancel', requireAdmin, projectController.cancelProject);

// Update project (Admin anytime, Client only before admin approval)
router.put('/:id', projectController.updateProject);
router.post('/:id/update', projectController.updateProject);

// Editor Accept Assignment & Start Work
router.post('/:id/accept-assignment', requireEditor, projectController.acceptAssignment);

// Client Review Delivery: Request Revision or Approve
router.post('/:id/client-revision', projectController.clientRequestRevision);
router.post('/:id/client-approve', projectController.clientApproveDelivery);

// Client Submit Payment (UTR & Details)
router.post('/:id/submit-payment', projectController.submitClientPayment);

// Delete Project (Client for own project if added by mistake/not required, Admin for any)
router.delete('/:id', projectController.deleteProject);
router.post('/:id/delete', projectController.deleteProject);

module.exports = router;

