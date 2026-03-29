import mongoose from 'mongoose';

async function check() {
  await mongoose.connect('mongodb+srv://bhimanijay89:bhimanijay89@cluster0.bwo5lmi.mongodb.net/insta_scheduler?retryWrites=true&w=majority&appName=Cluster0');
  
  const PostSchema = new mongoose.Schema({}, { strict: false, collection: 'posts' });
  const Post = mongoose.model('Post', PostSchema);
  
  const posts = await Post.find().sort({ createdAt: -1 }).limit(5).lean();
  console.log(JSON.stringify(posts, null, 2));

  process.exit(0);
}
check();
