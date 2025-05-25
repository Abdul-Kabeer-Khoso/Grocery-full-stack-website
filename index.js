const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const app = express();


//Path Setup for views directory
const path = require('path');
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use('/public', express.static(path.join(__dirname, "public")));
app.use(express.static('public'));


//uuid 
const {v4: uuidv4} = require('uuid');

//Method Override
const methodOverride = require('method-override');
app.use(methodOverride('_method'));


//MySQL setup
const mysql = require('mysql2');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    database: 'grocify_web',
    password: 'admin123'
})

connection.connect(err=>{
    if(err) throw err;
    console.log('MySQL Connected');
})



//Passport setup
const passport = require('passport');
const localStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');


app.use(session({
    secret: "secret_key",
    resave: false,
    saveUninitialized: false
}));

app.use(flash());

app.use(passport.initialize());
app.use(passport.session());




require('./configPassport.js')(passport, connection);

//Home Page
app.get("/product", (req, res)=>{
    let productsNumberQuery = 'select * from Cart';
    try{
        connection.query(productsNumberQuery, (err, result)=>{
            if(err){
                res.send("There is something error in products Number Query");
            } else{
                res.render('products.ejs', {totalCartProducts: result.length});
            }
        })
    } catch(err){
        res.send("There is something error in home page")
    }
});

//show all products
app.get("/product/all", async (req, res)=>{
    let showProductQuery = 'select * from Products';
    let productsNumberQuery = 'select * from Cart';
    try{
        let [myProducts] = await connection.promise().query(showProductQuery);
        let [productsNumber] = await connection.promise().query(productsNumberQuery);
        let allProducts = myProducts;
        let totalCartProducts = productsNumber.length;
        res.render('allProducts.ejs', {products: allProducts, totalCartProducts: totalCartProducts});
        }catch(err){
        res.send("There is something error in showing all products");
    }
})

//Show Cart 
app.get("/product/cart", (req, res)=>{
    let getCartProductQuery = 'select p.productId, p.productName, p.newPrice, p.productImage1, c.productQuantity from Products p join Cart c on p.productId = c.productId';
    try{
        connection.query(getCartProductQuery, (err, result)=>{
         let  products = result.map(product => {
            const totalPricePerItem = product.newPrice * product.productQuantity;
            return {
                ...product,
                totalPricePerItem: totalPricePerItem
            };
            });
            const productLength = products.length;
            const prices = products.map(product=> product.totalPricePerItem);
            const price = prices.reduce((sum, price)=> sum + price, 0);
            const tax = price * 0.02;
            const totalPrice = tax + price;
            if(err){
                res.send("There is error in query of showing cart product");
            } else{
                res.render('cart.ejs', {products: products, price: price, tax: tax.toFixed(1), totalPrice: totalPrice.toFixed(1), totalCartProducts: productLength });
            }
        })
    } catch (err){
        res.send("There is something error in showing cart product");
    }
})

//add new address
app.get("/product/address", (req, res)=>{
    res.render('addAddress.ejs');
})

// Details of Product
app.get("/product/:id", async (req, res)=>{
    let {id}= req.params;
    let findProductQuery = `select * from Products where productId = "${id.toString()}"`;
    let findRelatedProductsQuery = 'select * from Products where productCategory = ?';
    let productNumberQuery = 'select * from Cart';
    try{
        let productDetails =await connection.promise().query(findProductQuery);
        let myProductDetails = productDetails[0][0];
        let relatedProducts = await connection.promise().query(findRelatedProductsQuery, [myProductDetails.productCategory]);
        let myRelatedProducts = relatedProducts[0];
        let productNumber = await connection.promise().query(productNumberQuery);
        let totalCartProducts = productNumber[0].length;
        if(productDetails && relatedProducts){
            res.render('productDetails.ejs', {product: myProductDetails, relatedProducts: myRelatedProducts, totalCartProducts: totalCartProducts})
        }
        else{
            res.send("There is something error in logic");
        }

    } catch(err){
        res.send(err);
    }
})

//Show Seller Products
app.get("/seller", (req, res)=>{
    let allProducts = 'select * from Products';
    try{
      connection.query(allProducts, (err, result)=>{
        res.render('seller.ejs', {result})
      })
    }catch(err){
        res.send(err);
    }

})


//Add Product
app.post("/seller/add", (req, res)=>{
    let {product} = req.body;
    let productId = uuidv4();
    let addQuery = "INSERT INTO Products (productId, productName, productCategory, productImage1, productReviews, productDescription, oldPrice, newPrice, inStock) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE);"
    try{
        connection.query(addQuery, 
            [productId, product.productName, product.productCategory, product.image1URL, '4', product.productDescription, product.productOldPrice, product.productNewPrice, ], 
            (err, result)=>{
                 if(err){
                    res.send("There is something error in add product query");
                 }   
                 else{
                    res.redirect('/seller');
                 }
            })
    }catch(err){
        res.send(err);
    }
})

//Adding product to cart using add to cart button
app.post('/product/add/:id', (req, res)=>{
    let productId = req.params.id;
    let addToCartQuery = 'insert into Cart(productId) values (?)';
    try{
        connection.query(addToCartQuery, [productId], (err, result)=>{
            if(err){
                res.send("There is something error in adding product to cart using add to cart button");
            } else{
                res.redirect(`/product/${productId}`);
            }
        })
    } catch(err){
        res.send("There is something error in adding product to cart using add to cart button");
    }
})


//Add to cart
app.post("/product/:id", (req, res)=>{
    let productId = req.params.id;
    let addToCartQuery = 'insert into Cart(productId) values (?)';
    try{
        connection.query(addToCartQuery, [productId], (err, result)=>{
            if(err){
                res.send("There is something error in query of add to cart");
            } else{
                res.redirect("/product/all");
            }
        })
    } catch (err){
        res.send("There is something error in add to cart");
    }
})


//Delete product from cart
app.delete("/product/:id", (req, res)=>{
    let productId = req.params.id;
    let deleteProductCartQuery = `delete from Cart where productId = ?`; 
    try{
        connection.query(deleteProductCartQuery, [productId], (err, result)=>{
            if(err){
                res.send("There is something error in removing product form cart's query");
            } else{
                res.redirect('/product/cart');
            }
        })
    } catch(err){
        res.send("There is something error in removing product from cart");
    }
})


//Update Product Quantity in cart
app.patch("/product/:id", (req, res)=>{
    let productId = req.params.id;
    let quantity = req.body.quantity;
 
    let updateCartQtyQuery = 'update Cart set productQuantity = ? where productId = ?';
    try{
        connection.query(updateCartQtyQuery, [quantity, productId], (err, result)=>{
            if(err){
                res.send("There is something error in updating product quantity query");
            } else{
                res.redirect('/product/cart');
            }
        })
    }
    catch (err){
        res.send("There is something error in updating quantity of product in cart");
    }
})

app.post('/product/user/signup', async (req, res)=>{
    let user = req.body.user;
    let userId = uuidv4();
    let username = user.username;
    let password = user.password;
    let useremail = user.email;



    try{

        console.log("before query");
        let hashedPassword = await bcrypt.hash(password, 10);
        connection.query('insert into Users(userId ,username, userpassword, email) values (? , ?, ?, ?)', [userId, username, hashedPassword, useremail], (err, result)=>{
            if(err){
                return res.status(500).send("Error signing up!");
            }
            else{
                res.redirect('/product');
            }
        })
        
    } catch(err){
        res.send("There is something error in signup route");

    }
})


app.post('/product/user/login', passport.authenticate('local', {
    successRedirect: '/product',
    failureRedirect: '/product/cart',
    failureFlash: true
}))

app.listen(8080, ()=>{
    console.log("App is listening");
})



