require("dotenv").config();

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const nodemailer = require("nodemailer");
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const open = require("child_process").exec;


const Crop = require("./models/Crop");
const User = require("./models/User");
const Subscription = require("./models/Subscription");
const Order = require("./models/order");
const Contact= require("./models/Contact");
const Chat = require("./models/Chat");


const app = express();
// app.use(express.static(__dirname));
// const PORT = 5000;

const PORT = process.env.PORT || 5000;

const http = require('http').createServer(app);
const io = require('socket.io')(http);  
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on("chat message", async ({ sender, text, roomId }) => {
    try {
      // Fetch role from MongoDB
      const user = await User.findOne({ email: sender });
      const role = user?.role || "user"; // fallback in case user not found

      const msg = {
        sender,
        role,
        text,
        roomId,
        timestamp: new Date()
      };

      // Emit to specific room or all
      if (roomId) {
        io.to(roomId).emit("chat message", msg);
      } else {
        io.emit("chat message", msg);
      }

      await Chat.create(msg);
    } catch (err) {
      console.error("Error handling chat message:", err);
    }
  });

  socket.on("join room", (roomId) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room: ${roomId}`);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});







// Middleware

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session config
app.use(
  session({
    secret: "agrolink_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Static folders
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/assets", express.static(path.join(__dirname, "assets")));

// HTML Routes
    const pages = [
      "login", "signup", "index", "sell", "crops", "crop-detail",
      "register", "cart", "checkout", "order-confirmation", "update-status", "order-status", "contact", "choose-role", "chat"
    ];
    pages.forEach((page) => {
      app.get(`/${page}.html`, (req, res) => res.sendFile(path.join(__dirname, `${page}.html`)));
    });
    app.get("/", (req, res) => res.redirect("/login.html"));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// MongoDB setup
mongoose.set("strictQuery", false);
mongoose.set("bufferCommands", false);

mongoose
  .connect(process.env.MONGODB_URI)

  .then(() => {
    console.log("MongoDB connected");

    // Passport serialization
    passport.serializeUser((user, done) => done(null, user.id));
    passport.deserializeUser(async (id, done) => {
      const user = await User.findById(id);
      done(null, user);
    });

    // Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      const email = profile.emails[0].value;
      let user = await User.findOne({ email });

      if (user) {
  if (!user.role) {
    user.role = global.oauthRole || "buyer";
    await user.save();
  }
  return done(null, user);
}

      const role = global.oauthRole || "buyer"; // fallback
      user = new User({
        name: profile.displayName,
        email,
        password: "google_oauth",
        role
      });

      await user.save();
      done(null, user);
    }
  )
);

// Facebook Strategy
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: process.env.FACEBOOK_CALLBACK_URL,
      profileFields: ["id", "displayName", "emails"],
    },
    async (accessToken, refreshToken, profile, done) => {
      const email = profile.emails?.[0]?.value;
      if (!email) return done(null, false);

      let user = await User.findOne({ email });
      if (user) {
  if (!user.role) {
    user.role = global.oauthRole || "buyer";
    await user.save();
  }
  return done(null, user);
}


      const role = global.oauthRole || "buyer";
      user = new User({
        name: profile.displayName,
        email,
        password: "facebook_oauth",
        role
      });

      await user.save();
      done(null, user);
    }
  )
);

// Google OAuth Callback
app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login.html" }),
  (req, res) => {
    const role = req.user.role;
    if (role === "farmer") return res.redirect("/sell.html");
    return res.redirect("/index.html"); // buyer or admin
  }
);

// Facebook OAuth Callback
app.get("/auth/facebook/callback",
  passport.authenticate("facebook", { failureRedirect: "/login.html" }),
  (req, res) => {
    const role = req.user.role;
    if (role === "farmer") return res.redirect("/sell.html");
    return res.redirect("/index.html"); // buyer or admin
  }
);



// Capture role from query param for Google login
app.get("/auth/google", (req, res, next) => {
  global.oauthRole = req.query.role || "buyer";
  next();
}, passport.authenticate("google", { scope: ["profile", "email"] }));

// Capture role from query param for Facebook login
app.get("/auth/facebook", (req, res, next) => {
  global.oauthRole = req.query.role || "buyer";
  next();
}, passport.authenticate("facebook", { scope: ["email"] }));


    

    const Contact = require('./models/Contact');` ` 

app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;
  try {
    const newContact = new Contact({ name, email, subject, message });
    await newContact.save();
    res.json({ success: true, message: 'Your message has been saved. We will get back to you shortly!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to save message.' });
  }
});


    

    // API: Get all crops
    app.get("/api/crops", async (req, res) => {
      try {
        const crops = await Crop.find();
        res.json(crops.map(c => ({ ...c._doc, image: c.image?.replace(/\\/g, "/") })));
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch crops" });
      }
    });

    // API: Get crop by ID
    app.get("/api/crops/:id", async (req, res) => {
      try {
        const crop = await Crop.findById(req.params.id);
        if (!crop) return res.status(404).json({ error: "Crop not found" });

        res.json({ ...crop._doc, image: crop.image?.replace(/\\/g, "/") });
      } catch (err) {
        res.status(500).json({ error: "Failed to fetch crop details" });
      }
    });


    // API: Post crop
    app.post("/api/crops", upload.single("image"), async (req, res) => {
      try {
       const { name, category, price, quantity, location, description, sellerEmail } = req.body;

        const newCrop = new Crop({
          name,
          category,
          price,
          quantity,
          location,
          sellerEmail,
          description,
          image: req.file ? `/uploads/${req.file.filename}` : "",
        });

        await newCrop.save();
        res.status(201).json({ message: "Crop listed successfully", crop: newCrop });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });
//  API: Stats route for "Our Impact" section (including Delivered Orders)
app.get("/api/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCrops = await Crop.countDocuments();
    const totalOrders = await Order.countDocuments({ status: "Delivered" }); //  Only Delivered

    res.json({ totalUsers, totalCrops, totalOrders });
  } catch (err) {
    console.error("Stats fetch error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});







    // Subscription route
    app.post("/subscribe", async (req, res) => {
      try {
        const { name, email } = req.body;
        const subscription = new Subscription({ name, email });
        await subscription.save();

        res.send(`
          <h2 style="text-align:center;margin-top:2rem;">
            Thank you for subscribing to AgroLink Premium! 🎉<br>
            Enjoy free delivery.
          </h2>
          <p style="text-align:center;"><a href="/index.html">Back to Home</a></p>
        `);
      } catch (error) {
        console.error("Subscription Error:", error);
        res.status(500).send("Error saving subscription. Try again later.");
      }
    });

   


// app.post("/api/checkout", async (req, res) => {
//   try {
//     const { customer, items, totalAmount, gst, delivery } = req.body;

//     if (!customer || !items || items.length === 0) {
//       return res.status(400).json({ success: false, message: "Missing order data" });
//     }

//     const order = new Order({
//       customer,
//       items,
//       totalAmount,
//       gst,
//       delivery,
//       placedAt: new Date()
//     });

//     await order.save();





//     res.json({ success: true, orderId: order._id });
//   } catch (error) {
//     console.error("Order error:", error);
//     res.status(500).json({ success: false, message: "Something went wrong" });
//   }
// });




app.post("/signup", async (req, res) => {
  try {
    const { name, email, password, confirmPassword, role } = req.body;
    if (password !== confirmPassword) return res.status(400).json({ success: false, message: "Passwords do not match" });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();

    req.session.userId = user._id;

    res.status(200).json({ success: true, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Error signing up" });
  }
});


    // Login
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Invalid email or password" });

    req.session.userId = user._id;

    //  Send role back to frontend for redirection
    res.status(200).json({ success: true, role: user.role });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Error logging in" });
  }
});



    // Test route
    app.get("/test-users", async (req, res) => {
      try {
        const users = await User.find();
        res.json(users);
      } catch (err) {
        res.status(500).send("User model broken: " + err.message);
      }
    });

    // Logout
    app.get("/logout", (req, res) => {
      req.session.destroy(() => {
        res.redirect("/login.html");
      });
    });
 


    // Start server
   http.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  // open(`start http://localhost:${PORT}`);
});


// 1. GET order by ID
    app.get("/api/orders/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// 2. PATCH status of order
app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ success: true, updatedStatus: order.status });
    io.emit('orderStatusUpdated', { orderId: order._id, status: order.status });

  } catch (err) {
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// Cancel order by ID
app.patch("/api/orders/:id/cancel", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (["Shipped", "Out for Delivery", "Delivered"].includes(order.status)) {
      return res.status(400).json({ success: false, message: "Cannot cancel this order now" });
    }

    order.status = "Cancelled";
    await order.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Cancel order error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
//  Return order by ID
app.patch("/api/orders/:id/return", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.status !== "Delivered") {
      return res.status(400).json({ success: false, message: "Only delivered orders can be returned" });
    }

    order.status = "Returned";
    await order.save();
    res.json({ success: true });
  } catch (err) {
    console.error("Return order error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// contact-us page

app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message } = req.body;

  try {
    // Save to DB
    const newContact = new Contact({ name, email, subject, message });
    await newContact.save();

    // Setup email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const mailOptions = {
      from: `"AgroLink Contact" <${process.env.EMAIL_USER}>`,  
      to: process.env.EMAIL_USER,  //  You receive this message
      subject: `New Contact Message: ${subject}`,
      text: `
You have a new message from the AgroLink contact form.

Name: ${name}
Email: ${email}
Subject: ${subject}

Message:
${message}
      `
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: 'Your message has been sent and saved!' });

  } catch (err) {
    console.error("Contact form error:", err);
    res.status(500).json({ success: false, message: 'Failed to send or save message.' });
  }
});

// socket.io connection
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});


app.get("/choose-role", (req, res) => {
  if (!req.session.userId) return res.redirect("/login.html");
  res.sendFile(path.join(__dirname, "choose-role.html"));
});

app.post("/set-role", async (req, res) => {
  try {
    if (!req.session.userId) return res.status(401).send("Unauthorized");

    const { role } = req.body;
    if (!["farmer", "buyer"].includes(role)) return res.status(400).send("Invalid role");

    await User.findByIdAndUpdate(req.session.userId, { role });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("Role set error:", err);
    res.status(500).send("Error setting role");
  }
});


app.get("/api/chat/:user1/:user2", async (req, res) => {
  const { user1, user2 } = req.params;

  try {
    const chats = await Chat.find({
      $or: [
        { sender: user1, receiver: user2 },
        { sender: user2, receiver: user1 }
      ]
    }).sort({ timestamp: 1 });

    res.json(chats);
  } catch (err) {
    console.error("Chat fetch error:", err);
    res.status(500).json({ error: "Failed to load chat history" });
  }
});



app.get("/api/chat-history", async (req, res) => {
  const { roomId } = req.query;

  try {
    const chats = await Chat.find({ roomId }).sort({ timestamp: 1 });
    res.json(chats);
  } catch (err) {
    console.error("Chat history fetch error:", err);
    res.status(500).send("Failed to fetch chat history");
  }
});





  })
  .catch((err) => console.error("MongoDB connection error:", err));

    // Example using Express + Mongoose
app.get("/api/crops/search", async (req, res) => {
  const query = req.query.query;
  // console.log("Search query received:", query);  //  Log it

  if (!query) {
    return res.status(400).json({ error: "No crop query provided" });
  }

  try {
    const regex = new RegExp(query, "i");
    const crops = await Crop.find({ name: regex });

    // console.log("Matching crops found:", crops.length);  //  Log how many found

    res.json(crops.map(c => ({ ...c._doc, image: c.image?.replace(/\\/g, "/") })));
  } catch (error) {
    console.error(" Error in /api/crops/search:", error.message, error.stack); // More debug info
    res.status(500).json({ error: "Failed to fetch crop details" });
  }
});




// Checkout Route
app.post("/api/checkout", async (req, res) => {
  try {
    let {
      customer,
      items,
      totalAmount,
      gst,
      delivery,
      expectedDeliveryDate,
      paymentMethod,
      paymentId,
      razorpayOrderId,
    } = req.body;

    // Validate customer info and items
    if (!customer || !items || items.length === 0 || !paymentMethod) {
      return res
        .status(400)
        .json({ success: false, message: "Missing order data" });
    }

    // Normalize email
    if (customer.email) {
      customer.email = customer.email.trim().toLowerCase();
    }

    // Parse delivery date safely
    const parsedDate = new Date(expectedDeliveryDate);
    if (isNaN(parsedDate.getTime())) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid delivery date" });
    }

    // Set order status
    let orderStatus = paymentMethod === "razorpay" ? "Paid" : "Confirmed";

    // Save Order
    const newOrder = new Order({
      customer,
      items,
      totalAmount,
      gst,
      delivery,
      expectedDeliveryDate: parsedDate,
      paymentMethod,
      paymentId,
      razorpayOrderId,
      status: orderStatus,
      placedAt: new Date(),
    });

    const savedOrder = await newOrder.save();

    // Update crop stock
    for (const item of items) {
      const crop = await Crop.findById(item.id);
      if (crop) {
        const quantityParts = crop.quantity.split(" ");
        let cropQty = parseInt(quantityParts[0]);
        const unit = quantityParts.slice(1).join(" ");
        const itemQty = parseInt(item.quantity);

        if (cropQty <= 0 || crop.status === "Out of Stock") {
          return res.status(400).json({
            success: false,
            message: `Sorry, ${crop.name} is Out of Stock`,
          });
        }

        if (itemQty > cropQty) {
          return res.status(400).json({
            success: false,
            message: `Only ${cropQty} ${unit} of ${crop.name} is available`,
          });
        }

        let newQty = cropQty - itemQty;
        if (newQty <= 0) {
          crop.quantity = `0 ${unit}`;
          crop.status = "Out of Stock";
        } else {
          crop.quantity = `${newQty} ${unit}`;
        }

        await crop.save();
      }
    }

    // Email setup
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const cropList = items
      .map((item) => `- ${item.name} x${item.quantity}`)
      .join("\n");

    // Email to Buyer
    await transporter.sendMail({
      from: '"AgroLink" <your@email>',
      to: customer.email,
      subject: "Your AgroLink Order is Confirmed!",
      text: `Hi ${customer.fullName},\n\nYour order has been confirmed and will be delivered by ${parsedDate.toDateString()}.\n\nOrder Details:\n${cropList}\n\nThank you for using AgroLink! 🌾`,
    });

    // Email to Sellers
    for (const item of items) {
      const crop = await Crop.findById(item.id);
      if (!crop || !crop.sellerEmail) continue;

      await transporter.sendMail({
        from: '"AgroLink" <your@email>',
        to: crop.sellerEmail,
        subject: "You have a new order on AgroLink!",
        text: `Dear Seller,\n\nYour crop "${crop.name}" has been ordered.\n\nOrder Details:\n- Quantity: ${item.quantity}\n\nDeliver to:\n${customer.fullName}\n${customer.address}, ${customer.city}, ${customer.state} - ${customer.pincode}\nPhone: ${customer.phone}\nExpected Delivery: ${parsedDate.toDateString()}`,
      });
    }

    res.json({ success: true, orderId: savedOrder._id });

  } catch (err) {
    console.error("Checkout Error:", err);
    res.status(500).json({ success: false, message: "Something went wrong." });
  }
});


   app.get("/api/razorpay-key", (req, res) => {
  res.json({ key: process.env.RAZORPAY_KEY_ID });
});

const Razorpay = require("razorpay");
console.log("🔑 Razorpay Key ID:", process.env.RAZORPAY_KEY_ID);
console.log("🔐 Razorpay Key Secret:", process.env.RAZORPAY_KEY_SECRET ? "Loaded" : "Not Loaded");


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

app.post("/api/create-order", async (req, res) => {
  const { amount } = req.body;

  const options = {
    amount: amount * 100, // amount in paise
    currency: "INR",
    receipt: "order_rcptid_" + Date.now(),
  };

  try {
    const order = await razorpay.orders.create(options);
    console.log("✅ Razorpay Order Created:", order); // Add this for debugging
    res.json(order);
  } catch (err) {
    console.error("❌ Razorpay order error:", err); // Helpful debug log
    res.status(500).json({ error: "Failed to create order" });
  }
});



app.get("/api/orders", async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: "Email required" });

    const orders = await Order.find({ "customer.email": email }).sort({ placedAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ success: false, message: "Failed to load orders" });
  }
});

