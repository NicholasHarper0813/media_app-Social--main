const express = require('express');
const mongoose = require('mongoose');
const methodOverride = require('method-override');
const cookieParser = require('cookie-parser');
const exphbs = require('express-handlebars');
const session = require("express-session");
const bodyParser = require("body-parser");
const passport = require('passport');
const Handlebars = require('handlebars');
const keys = require('./config/keys.js');
const User = require('./models/user.js');
const Post = require('./models/post');

const {allowInsecurePrototypeAccess} = require('@handlebars/allow-prototype-access');

require('./passport/google-passport');
require('./passport/facebook-passport');

const 
{
    ensureAuthentication,
    ensureGuest
} = require('./helpers/auth');

const app = express();

app.engine('handlebars', exphbs({
    defaultLayout: 'main',
    handlebars: allowInsecurePrototypeAccess(Handlebars)
}));
app.set('view engine', 'handlebars');
app.use(cookieParser());
app.use(bodyParser.urlencoded({ 
    extended: false 
}));
app.use(bodyParser.json());
app.use(session({ 
    secret: 'keyboard cat',
    resave: true,
    saveUninitialized: true 
}));
app.use(methodOverride('_method'));
app.use(passport.initialize());
app.use(passport.session());
app.use((req, res, next) => {
    res.locals.user = req.user || null;
    next();
});
app.engine('handlebars', exphbs({
    defaultLayout: 'main'
}));
app.set('view engine', 'handlebars');
app.use(express.static('public'));

mongoose.Promise = global.Promise;
mongoose.connect(keys.MongoURI, {
    useUnifiedTopology: true,
    useNewUrlParser: true
})
.then(() =>{
    console.log(`Connected to remote database....`);
}).catch((err) => {
    console.log(err);
});

const port = process.env.PORT || 3000;
app.get('/', ensureGuest, (req, res) => {
    res.render('home');
});
app.get('/about', (req, res) => {
    res.render('about');
});
app.get('/auth/google',
  passport.authenticate('google', { 
    scope: ['profile', 'email'] 
}));
app.get('/auth/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: '/login'
 }),
  (req, res) => {
    res.redirect('/profile');
  });
app.get('/auth/facebook',
  passport.authenticate('facebook',{
      scope: 'email'
  }));
app.get('/auth/facebook/callback',
  passport.authenticate('facebook', { 
      failureRedirect: '/' 
  }),
  (req, res) => {
    res.redirect('/profile');
  });
app.get('/profile', ensureAuthentication, (req, res) => {
    Post.find({user: req.user._id})
    .populate('user')
    .sort({date:'desc'})
    .then((posts) => {
        res.render('profile', {
            posts:posts
        });
    }); 
});
app.get('/users', ensureAuthentication, (req, res) => {
    User.find({}).then((users) =>{
        res.render('users', {
            users:users
        });
    });
});
app.get('/user/:id', ensureAuthentication, (req, res) => {
    User.findById({_id: req.params.id})
    .then((user) => {
        res.render('user', {
            user:user
        });
    });
});
app.post('/addEmail', ensureAuthentication, (req, res) => {
    const email = req.body.email;
    User.findById({_id: req.user._id})
    .then((user) => {
        user.email = email;
        user.save()
        .then(() => {
            res.redirect('/profile');
        })
    })
})
app.post('/addPhone', ensureAuthentication, (req, res) => {
    const phone = req.body.phone;
    User.findById({_id: req.user._id})
    .then((user) => {
        user.phone = phone;
        user.save()
        .then(() => {
            res.redirect('/profile');
        })
    });
});
app.post('/addLocation', ensureAuthentication, (req, res) => {
    const location = req.body.location;
    User.findById({_id: req.user._id})
    .then((user) => {
        user.location = location;
        user.save()
        .then(() => {
            res.redirect('/profile');
        })
    });
});
app.get('/addPost', ensureAuthentication, (req, res) => {
    res.render('addPost');
});
app.post('/savePost', ensureAuthentication, (req, res) => {
    var allowComments;
    if(req.body.allowComments)
    {
        allowComments = true;
    }
    else
    {
        allowComments = false;
    }
    const newPost = {
        title: req.body.title,
        body: req.body.body,
        status: req.body.status,
        allowComments: allowComments,
        user: req.user._id
    }
    new Post(newPost).save()
    .then(() => {
        res.redirect('/posts');
    });
});
app.get('/editPost/:id', ensureAuthentication, (req, res) => {
    Post.findOne({_id: req.params.id})
    .then((post) => {
        res.render('editingPost', {
            post:post
        });
    });
});
app.put('/editingPost/:id', ensureAuthentication, (req, res) => {
    Post.findOne({_id: req.params.id})
    .then((post) => {
        var allowComments;
        if(req.body.allowComments){
            allowComments = true;
        }else{
            allowComments = false;
        }
        post.title = req.body.title;
        post.body = req.body.body;
        post.status = req.body.status;
        post.allowComments = allowComments;
        post.save()
        .then(() => {
            res.redirect('/profile');
        });
    });
});
app.get('/logout', (req, res) => {
    req.logOut();
    res.redirect('/');
});
app.delete('/:id', ensureAuthentication, (req, res) => {
    Post.remove({_id: req.params.id})
    .then(() => {
        res.redirect('profile');
    })
})
app.get('/posts', ensureAuthentication, (req, res) => {
    Post.find({status: 'public'})
    .populate('user')
    .populate('comments.commentUser')
    .sort({date: 'desc'})
    .then((posts) => {
        res.render('publicPosts', {
            posts:posts
        });
    });
});

app.get('/showposts/:id', ensureAuthentication, (req, res) => {
    Post.find({user: req.params.id, status: 'public'})
    .populate('user')
    .sort({date: 'desc'})
    .then((posts) => {
        res.render('showUserPosts', {
            posts:posts
        });
    });
});
app.post('/addComment/:id', ensureAuthentication, (req, res) => {
    Post.findOne({_id: req.params.id})
    .then((post) => {
        const newComment = {
            commentBody: req.body.commentBody,
            commentUser: req.user._id
        }
        post.comments.push(newComment)
        post.save()
        .then(() => {
            res.redirect('/posts');
        })
    });
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
