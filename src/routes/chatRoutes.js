const experess = require("express");
const router = experess.Router();
const { chat } = require("../controllers/chatController");
const { allowPublic, verifyToken } = require("../middleware/authVerify");

const {
  createSession,
  saveMessage,
  getSession,
  getSessions,
  deleteSession,
  deleteAllSessions
} = require("../controllers/chatController");

/**
 * @swagger
 * tags:
 *   - name: Chat
 *     description: Chat functionality for the portfolio website
 */

/**
 * @swagger
 * /api/ai/chat:
 *   post:
 *     summary: Chat with AI about portfolio
 *     tags: [AI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: AI response
 */
// router.post('/chat', allowPublic, chat);
router.post("/chat", allowPublic, chat);


/**
 * @swagger
 * /api/chat/session:
 *   post:
 *     summary: Create chat session
 *     tags: [Chat]
 */
router.post("/createSession",  allowPublic, createSession);

/**
 * @swagger
 * /api/chat/message:
 *   post:
 *     summary: Save message
 *     tags: [Chat]
 */
router.post("/message",  allowPublic, saveMessage);

/**
 * @swagger
 * /api/chat/session/{id}:
 *   get:
 *     summary: Get session messages
 *     tags: [Chat]
 */
router.get("/getSessionById/:id", allowPublic, getSession);

/**
 * @swagger
 * /api/chat/sessions:
 *   get:
 *     summary: Get all sessions
 *     tags: [Chat]
 */
router.get("/getSessions", allowPublic, getSessions);

/**
 * @swagger
 * /api/chat/session/{id}:
 *   delete:
 *     summary: Delete chat session
 *     tags: [Chat]
 */
router.delete("/deleteSessionById/:id", allowPublic, deleteSession);

/**
 * @swagger
 * /api/chat/sessions:
 *   delete:
 *     summary: Delete all chat sessions
 *     tags: [Chat]
 */
router.delete("/deleteAllSessions", allowPublic, deleteAllSessions);

module.exports = router;