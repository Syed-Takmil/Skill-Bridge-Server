import express, { Express, Request, Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environmental variables from your .env file
dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

// --- MIDDLEWARES ---
app.use(cors());
app.use(express.json());

// --- MONGODB CONNECTION ---
const client = new MongoClient(MONGODB_URI);
const db = client.db('SkillBridge');

// Collections
const skillsCollection = db.collection('Skills');
const usersCollection = db.collection('user');
const requestsCollection = db.collection('requests');

async function connectDB() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB successfully!');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
  }
}
connectDB();

// --- SAMPLE ROUTE ---
app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'API is running smoothly with MongoDB 🚀' });
});

// --- SKILLS ROUTES ---

// GET /skills - Fetch all skills
app.get('/skills', async (req: Request, res: Response) => {
  try {
    const skills = await skillsCollection.find({}).toArray();
    res.status(200).json(skills);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

// GET /skills/:id - Fetch a single skill by ID (supports both standard ObjectId and custom numeric id)
app.get('/skills/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let query: any = {};

    if (ObjectId.isValid(id)) {
      // If it is a valid 24-character Mongo Hex string, query by _id
      query = { _id: new ObjectId(id) };
    } else if (!isNaN(Number(id))) {
      // If it's a number, query by your custom numeric 'id' field
      query = { id: Number(id) };
    } else {
      // Otherwise, query custom 'id' as a string fallback
      query = { id: id };
    }

    const skill = await skillsCollection.findOne(query);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    res.status(200).json(skill);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch skill' });
  }
});

// POST /skills - Create a new skill listing
app.post('/skills', async (req: Request, res: Response) => {
  try {
    const {
      id, // Now explicitly extracting your custom numeric ID
      title,
      category,
      description,
      level,
      availability,
      languages,
      location,
      rating,
      reviewsCount,
      status,
      instructor,
      icon,         // 👈 FIXED: Successfully destructured from req.body
      curriculum,   // 👈 FIXED: Successfully destructured from req.body
    } = req.body;

    // 1. Backend validation check for required fields
    if (!title || !category || !description) {
      return res.status(400).json({ error: 'Title, category, and description are required fields.' });
    }

    // 2. Build the structured document matching your precise schema
    const newSkill = {
      id: id ? Number(id) : Math.floor(Math.random() * 1000000), // Ensures numeric 'id' exists
      title,
      category,
      description,
      level: level || 'Intermediate',
      availability: availability || 'Weekdays',
      languages: languages || 'English',
      location: location || 'Remote',
      rating: rating !== undefined ? Number(rating) : 5.0,
      reviewsCount: reviewsCount !== undefined ? Number(reviewsCount) : 0,
      status: status || 'Online',
      icon: icon || '✨',
      instructor: {
        name: instructor?.name || 'Anonymous User',
        avatarUrl: instructor?.avatarUrl || '',
        avatar: instructor?.avatar || '👤',
        role: instructor?.role || 'Community Member',
        bio: instructor?.bio || ''
      },
      curriculum: curriculum || [],
      createdAt: new Date()
    };

    // 3. Insert into MongoDB collection
    const result = await skillsCollection.insertOne(newSkill);

    // 4. Return success response with both MongoDB _id and custom id
    res.status(201).json({
      message: 'Skill registered successfully!',
      _id: result.insertedId,
      id: newSkill.id,
      skill: newSkill
    });

  } catch (error) {
    console.error('Error creating skill listing:', error);
    res.status(500).json({ error: 'Internal Server Error. Failed to submit new skill.' });
  }
});

// --- USERS ROUTES ---

// GET /users - Fetch all users
app.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await usersCollection.find({}).toArray();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// DELETE /users/:id - Delete a user by ID
app.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// --- REQUESTS ROUTES ---

// GET /requests - Fetch all requests
app.get('/requests', async (req: Request, res: Response) => {
  try {
    const requests = await requestsCollection.find({}).toArray();
    res.status(200).json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// POST /requests - Create a new request
app.post('/requests', async (req: Request, res: Response) => {
  try {
    const newRequest = req.body;
    
    // Quick validation helper: Check if body is empty
    if (!newRequest || Object.keys(newRequest).length === 0) {
      return res.status(400).json({ error: 'Request body cannot be empty' });
    }

    const result = await requestsCollection.insertOne(newRequest);
    res.status(201).json({
      message: 'Request created successfully',
      insertedId: result.insertedId,
      data: newRequest
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`⚡️[server]: Server running at http://localhost:${PORT}`);
});