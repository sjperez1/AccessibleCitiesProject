const {User} = require("./../models/user.model")
const {Post} = require('./../models/post.model')
const jwt = require("jsonwebtoken")
const crypto = require("crypto") // this library will help create random string of characters as the image title
const sharp = require("sharp") // this library will help resize the image

//aws-sdk s3client is a library used to interact with s3 bucket
const {S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand} = require("@aws-sdk/client-s3");

// this requires the dotenv library and call its config function
require('dotenv').config()


const bucketName = process.env.BUCKET_NAME
const bucketRegion = process.env.BUCKET_REGION
const bucketAccessKey = process.env.BUCKET_ACCESS_KEY
const secretBucketAccessKey = process.env.SECRET_BUCKET_ACCESS_KEY

const s3Bucket = new S3Client({ // the keys in this object must be written this way to properly upload in S3 bucket
    credentials: {
        accessKeyId: bucketAccessKey,
        secretAccessKey: secretBucketAccessKey,
    },
    region: bucketRegion
})

let randName = () => crypto.randomBytes(32).toString('hex')
let randImgName;


module.exports.allPosts = async (req, res) => {
    try {
        const postsPerPage = 6
        // whatever is after req.query will be the word in the URL that comes after the ? mark and before the equal sign. The query part is what makes the URL get setup this way. The following says go to the page number that is requested or 0
        console.log(req.query)
        const page = parseInt(req.query.page || 0)
        const total = await Post.countDocuments({})
        const posts = await Post.find({})
            .limit(postsPerPage)
            .skip(postsPerPage * page)
            res.json({
                totalPages: Math.ceil(total / postsPerPage),
                posts
            })
    } catch(err) {
        console.log(err)
    }
}

module.exports.addPicture = async (req, res) => {
    let reqFile = req.file
    // const buffer = await sharp(reqFile.buffer).resize({height: 10, width: 10}).toBuffer()
//     const buffer = await sharp(reqFile.buffer).resize({height: 80, width: 80,
// fit: sharp.fit.inside}).toBuffer()
// const buffer = await sharp(req.file.buffer)
//     .resize({ height: 300, width: null, fit: "inside" })
//     .toBuffer();
    await sharp(req.file.buffer)
    .resize({ height: 300, width: null, fit: "cover" })
    .toBuffer()
        .then(async data => {
            const bucketInfo = {
        Bucket: bucketName,
        Key: randImgName, // have to use this library because if images have the same name, they will be overwritten in the bucket. Using req.file.originalname would allow this to happen.
        Body: data,
        // in req.file.buffer, buffer is targeting the actual image. The rest in req.file is information about the image.
        ContentType: reqFile.mimetype,
    }
    console.log(bucketInfo["Key"])
    
    const sendPicInfo = new PutObjectCommand(bucketInfo)
    await s3Bucket.send(sendPicInfo) // await since want this asynchronous
    res.send({})
        })
        .catch(err => console.log(err))

    
    
}

module.exports.addPost = async(req, res) => {
    try {
        // adding the post into the model
        const reqbody = req.body
        console.log(reqbody)
        const newPost = Post(reqbody, reqbody["imgName"] = randName())
        randImgName = reqbody["imgName"]

        console.log("post body", req.body)
        const decodedJWT = jwt.decode(req.cookies.usertoken, {complete: true})
        const userId = decodedJWT.payload.id
        newPost.user = userId
        await newPost.save()

        // this will push the new post into User model
        const updatedUser = await User.findOneAndUpdate(
            {_id : userId},
            {$push : {posts : newPost}},
            {new : true}
        )
        res.json(updatedUser)
    } catch(err) {
        console.log(err)
        res.status(400).json(err)
    }
}

module.exports.oneUserPost = async(req, res) => {
    try {
        const decodedJWT = jwt.decode(req.cookies.usertoken, {complete: true})
        const userId = decodedJWT.payload.id
        const postsPerPage = 6
        // whatever is after req.query will be the word in the URL that comes after the ? mark and before the equal sign. The query part is what makes the URL get setup this way. The following says go to the page number that is requested or 0
        const page = parseInt(req.query.page || 0)
        const total = await Post.find({user: userId}).countDocuments({})
        const userposts = await Post.find({user: userId})
            .limit(postsPerPage)
            .skip((postsPerPage * page) >= 0 ? (postsPerPage * page) : 0)
            res.json({
                totalPages: Math.ceil(total / postsPerPage),
                userposts
            })
        } catch(err) {
            console.log(err)
            res.status(400).json(err)
        }
    }

module.exports.onePost = async (req, res)=>{
    const {getSignedUrl} = require("@aws-sdk/s3-request-presigner");

    // id is obtained by params (params are from URL)
    const idFromParams = req.params.id
    // give criteria to get id from params to make _id
    Post.findOne({_id: idFromParams})
        .then(onePost => {
            const getObjectParams = {
                Bucket: bucketName,
                Key: onePost["imgName"],
            }
            const objectParams = new GetObjectCommand(getObjectParams)
            const getURL = async (bucket, objParams) => {
                const imageURL = await getSignedUrl(bucket, objParams, {expiresIn: 3600});
                const updatedPost = Post.findOneAndUpdate(
                    {_id : idFromParams},
                    {imgURL : imageURL})
                return updatedPost
            } 
            getURL(s3Bucket, objectParams)
            res.json(onePost)
        })
        .catch(err=>res.json(err))
}

module.exports.deletePost = (req, res)=>{
    const idFromParams = req.params.id
    // give criteria to get id from params to make _id
    Post.findOne({_id: idFromParams})
        // cannot put res to the left of the arrow because res.json will look at that local res instead.
        .then(async deletePost=>{
            // console.log("deletePost", deletePost)
            const objectParams = {
                Bucket: bucketName,
                Key: deletePost["imgName"],
            }
            const deleteRequest = new DeleteObjectCommand(objectParams)
            await s3Bucket.send(deleteRequest)
            
            Post.deleteOne({_id: idFromParams})
                .then(deleted=>res.json(deleted))
                .catch(err=>res.json(err))
        })
        .catch(err=>res.json(err))
}
