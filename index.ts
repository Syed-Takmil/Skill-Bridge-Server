import express, { Express, Request, Response } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';

app.use(cors());
app.use(express.json());

const client = new MongoClient(MONGODB_URI);
const db = client.db('SkillBridge');

const skillsCollection = db.collection('Skills');
const usersCollection = db.collection('user');
const requestsCollection = db.collection('requests');

async function connectDB() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB successfully!');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

app.get('/', (req: Request, res: Response) => {
  res.json({ status: 'API is running smoothly with MongoDB 🚀' });
});

// --- SKILLS ROUTES ---

app.get('/skills', async (req: Request, res: Response) => {
  try {
    const { email } = req.query;
    let query = {};

    if (email && email !== 'undefined' && email !== '') {
      query = { 'instructor.email': email };
    }

    const skills = await skillsCollection.find(query).toArray();
    const sanitizedSkills = skills.map(skill => ({
      ...skill,
      _id: skill._id.toString()
    }));

    res.status(200).json(sanitizedSkills);
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ error: 'Failed to fetch skills' });
  }
});

app.get('/skills/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    let query: any = {};

    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else if (!isNaN(Number(id))) {
      query = { id: Number(id) };
    } else {
      query = { id: id };
    }

    const skill = await skillsCollection.findOne(query);
    if (!skill) {
      return res.status(404).json({ error: 'Skill not found' });
    }
    res.status(200).json(skill);
  } catch (error) {
    console.error('Error fetching single skill:', error);
    res.status(500).json({ error: 'Failed to fetch skill' });
  }
});

app.post('/skills', async (req: Request, res: Response) => {
  try {
    const {
      id,
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
      icon,
      curriculum,
    } = req.body;

    if (!title || !category || !description) {
      return res.status(400).json({ error: 'Title, category, and description are required fields.' });
    }

    const newSkill = {
      id: id ? Number(id) : Math.floor(Math.random() * 1000000),
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
        email: instructor?.email || '', 
        avatarUrl: instructor?.avatarUrl || '',
        avatar: instructor?.avatar || '👤',
        role: instructor?.role || 'Community Member',
        bio: instructor?.bio || ''
      },
      curriculum: curriculum || [],
      createdAt: new Date()
    };

    const result = await skillsCollection.insertOne(newSkill);

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

app.put('/skills/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;

    let query: any = {};
    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      const numericId = Number(id);
      if (!isNaN(numericId)) {
        query = { $or: [{ id: numericId }, { _id: id }] };
      } else {
        query = { $or: [{ id: id }, { _id: id }] };
      }
    }

    delete updatedData._id;
    delete updatedData.id;

    const result = await skillsCollection.findOneAndUpdate(
      query,
      { $set: updatedData },
      { returnDocument: 'after' } 
    );

    const updatedDocument = result && 'value' in result ? result.value : result;

    if (!updatedDocument) {
      return res.status(404).json({ message: 'Skill listing not found in DB.' });
    }

    res.status(200).json(updatedDocument);
  } catch (error: any) {
    console.error('❌ Error updating skill:', error);
    res.status(500).json({ message: 'Failed to update skill.', error: error.message });
  }
});

app.delete('/skills/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let query = {};

    if (ObjectId.isValid(id) && id.length === 24) {
      query = { 
        $or: [
          { _id: new ObjectId(id) },
          { _id: id }
        ]
      };
    } else {
      const numericId = Number(id);
      if (!isNaN(numericId)) {
        query = { id: numericId };
      } else {
        query = { id: id };
      }
    }

    const result = await skillsCollection.deleteOne(query);

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: `No skill found with ID: ${id}` });
    }

    res.status(200).json({ message: 'Skill deleted successfully!' });
  } catch (error) {
    console.error("Deletion error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// =================================================================
// --- USERS ROUTES ---
// =================================================================

// =================================================================
// --- USERS ROUTES ---
// =================================================================

// 1. GET ALL USERS
app.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await usersCollection.find({}).toArray();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// 2. NEW/COMPATIBILITY POST: Receives your new frontend's exact payload
app.post('/users', async (req: Request, res: Response) => {
  try {
    const { userId, name, image } = req.body;

    // We can query/update by the internal userId, or fallback to MongoDB's ObjectId if provided
    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    const updatedProfile = await usersCollection.findOneAndUpdate(
      { userId: userId },
      {
        $set: {
          name,
          userId,
          avatarUrl: image, // Map incoming 'image' to your database's 'avatarUrl' field
          updatedAt: new Date()
        }
      },
      { 
        upsert: true, 
        returnDocument: 'after' 
      }
    );

    res.status(200).json({
      message: 'User record saved successfully!',
      profile: updatedProfile
    });
  } catch (error) {
    console.error('Error in POST /users:', error);
    res.status(500).json({ error: 'Failed to create or update user collection.' });
  }
});

// 3. STATIC PATCH: Save / update user profile via Email
app.patch('/users/profile', async (req: Request, res: Response) => {
  try {
    const { name, email, avatarUrl, bio, expertise } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required to update a profile.' });
    }

    const updatedProfile = await usersCollection.findOneAndUpdate(
      { email: email },
      {
        $set: {
          name,
          email,
          avatarUrl,
          bio,
          expertise,
          updatedAt: new Date()
        }
      },
      { 
        upsert: true, 
        returnDocument: 'after' 
      }
    );

    res.status(200).json({
      message: 'Profile updated successfully!',
      profile: updatedProfile
    });
  } catch (error) {
    console.error('Error modifying user profile with PATCH:', error);
    res.status(500).json({ error: 'Failed to patch profile settings.' });
  }
});

// 4. STATIC GET: Explicit query params (e.g., /users/profile?email=test@test.com)
app.get('/users/profile', async (req: Request, res: Response) => {
  try {
    const email = req.query.email as string;
    
    if (!email) {
      return res.status(400).json({ error: 'Email query parameter is required.' });
    }

    const profile = await usersCollection.findOne({ email: email });
    if (!profile) {
      return res.status(200).json(null);
    }
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

// 5. DYNAMIC GET: Matches email segments (e.g., /users/test@example.com)
app.get('/users/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: 'Email parameter is required.' });
    }

    // Try finding by email, if not found try checking if the parameter is a userId
    let profile = await usersCollection.findOne({ email: email });
    
    if (!profile) {
      profile = await usersCollection.findOne({ userId: email });
    }

    if (!profile) {
      return res.status(200).json(null);
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error('Error fetching user profile with GET:', error);
    res.status(500).json({ error: 'Failed to retrieve profile settings.' });
  }
});

// 6. OTHER DYNAMIC USER ROUTES
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

// GET /requests - Fetch requests strictly filtered by real emails
app.get('/requests', async (req: Request, res: Response) => {
  try {
    const { requesterEmail, instructorEmail } = req.query;
    let query: any = null;

    // Check for valid requesterEmail (ignoring 'undefined' or empty string values)
    if (requesterEmail && requesterEmail !== 'undefined' && requesterEmail !== '') {
      query = { requesterEmail: requesterEmail as string };
    } 
    // Check for valid instructorEmail (ignoring 'undefined' or empty string values)
    else if (instructorEmail && instructorEmail !== 'undefined' && instructorEmail !== '') {
      query = { instructorEmail: instructorEmail as string };
    }

    // If query is still null, it means no valid email parameter was passed.
    // Return empty array instead of exposing the entire database!
    if (!query) {
      console.warn("⚠️ Unauthorized request fetching attempted without a valid email filter.");
      return res.status(200).json([]);
    }

    const requests = await requestsCollection.find(query).toArray();
    
    const sanitizedRequests = requests.map(reqDoc => ({
      ...reqDoc,
      _id: reqDoc._id.toString()
    }));

    res.status(200).json(sanitizedRequests);
  } catch (error) {
    console.error('Error fetching requests:', error);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

app.post('/requests', async (req: Request, res: Response) => {
  try {
    const newRequest = req.body;
    
    if (!newRequest || Object.keys(newRequest).length === 0) {
      return res.status(400).json({ error: 'Request body cannot be empty' });
    }

    const requestToInsert = {
      ...newRequest,
      status: 'Pending', 
      createdAt: new Date().toISOString() 
    };

    const result = await requestsCollection.insertOne(requestToInsert);
    res.status(201).json({
      message: 'Request created successfully',
      insertedId: result.insertedId,
      data: requestToInsert
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create request' });
  }
});

app.put('/requests/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body; 

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Invalid proposal status request.' });
    }

    const query = ObjectId.isValid(id) && id.length === 24 
      ? { _id: new ObjectId(id) } 
      : { _id: id };

    const updateResult = await requestsCollection.findOneAndUpdate(
      query,
      { $set: { status: status } },
      { returnDocument: 'after' }
    );

    let updatedDocument = null;
    if (updateResult) {
      if ('value' in updateResult) {
        updatedDocument = updateResult.value;
      } else {
        updatedDocument = updateResult; 
      }
    }

    if (!updatedDocument) {
      return res.status(404).json({ message: 'Exchange proposal document not found.' });
    }

    const sanitizedDocument = {
      ...updatedDocument,
      _id: updatedDocument._id.toString()
    };

    res.status(200).json(sanitizedDocument);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ message: 'Failed to complete update on MongoDB.' });
  }
});



async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`⚡️[server]: Server running at http://localhost:${PORT}`);
  });
}

startServer();