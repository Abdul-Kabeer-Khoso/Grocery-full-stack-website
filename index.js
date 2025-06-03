const express = require('express');
const app = express();
const ExpressError = require("./utils/ExpressError.js");
const wrapAsync = require("./utils/wrapAsync.js");
const session = require('express-session');
const flash = require('connect-flash');
app.use(flash());



//Path Setup for views directory
const path = require('path');
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({extended: true}));
app.use(express.json());
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

//Middlewares
const {isLoggedIn, saveRedirectUrl} = require("./middleware.js");


//Passport setup
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const { totalmem } = require('os');


app.use(session({
    secret: "secret_key",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false}
}));


app.use(passport.initialize());
app.use(passport.session());

require('./configPassport.js')(passport, connection);

app.use((req, res, next)=>{
    res.locals.success= req.flash("success");
    res.locals.error = req.flash("error");
    res.locals.currUser = req.user;
    next();
})



app.get("/logout", (req, res)=>{
    req.logout((err)=>{
        if(err){
            return next(err);
        }
        req.flash("success", "you are logged out");
        res.redirect("/product");
    })
})


app.get("/user/login", (req, res)=>{
    res.render("Users/login.ejs");
})

app.get("/user/signup", (req, res)=>{
    res.render("Users/signup.ejs");
})


//Home Page
app.get("/product", (req, res)=>{
    let user = res.locals.currUser;
    let productsNumberQuery = 'select * from Cart where userId = ?';
    try{
        if(user){
            connection.query(productsNumberQuery, [user.userId], (err, result)=>{
            if(err){
                res.send("There is something error in products Number Query");
            } else{
                res.render('Product/products.ejs', {totalCartProducts: result.length});
            }
        })
        }
        else{
            res.render('Product/products.ejs', {totalCartProducts: 0});
        }
         
    } catch(err){
        res.send("There is something error in home page")
    }
});

//Orders
app.get("/orders", isLoggedIn, async (req, res)=>{
    let user = res.locals.currUser;
    let productNumberQuery = 'select * from Cart where userId = ?';
    let orderQuery = 'select * from Orders where userId = ?';
    try{
            let productNumber = await connection.promise().query(productNumberQuery, [user.userId]);
            let totalCartProducts = productNumber[0].length;
            let ordersList = await connection.promise().query(orderQuery, [user.userId]);
            let orders = ordersList[0];
            let orderId = ordersList[0][0].orderId;
            res.render("Product/order.ejs", {totalCartProducts: totalCartProducts, orders: orders, orderId: orderId});   
    } catch(err){
        res.send(err);
    }
})

// Place order
app.post("/placeOrder", isLoggedIn,  (req, res)=>{
    let productIds = req.body.productId;
    let user = res.locals.currUser;
    let orderId = uuidv4();
    console.log(orderId);
    const values = productIds.map(pid => [orderId ,user.userId, pid]);
    let addOrderQuery = 'insert into Orders(orderId ,userId, productId) Values ?';
    try{
        connection.query(addOrderQuery, [values], (err, result)=>{
            if(err){
                res.send(err);
            }
            else{
                res.redirect("/orders");
            }
        })
    } catch(err){
        res.send(err);
    }
})

//show all products
app.get("/product/all", async (req, res)=>{
    let user = res.locals.currUser;
    let showProductQuery = 'select * from Products';
    let productsNumberQuery = `select * from Cart where userId = ?`;
    try{
        let [myProducts] = await connection.promise().query(showProductQuery);
        let allProducts = myProducts;
        if(user){
            let [productsNumber] = await connection.promise().query(productsNumberQuery, [user.userId]);
            let totalCartProducts = productsNumber.length;
            res.render('Product/allProducts.ejs', {products: allProducts, totalCartProducts: totalCartProducts});
        }
        else{
            res.render('Product/allProducts.ejs', {products: allProducts, totalCartProducts: 0});
        }
        
        
        }catch(err){
        res.send("There is something error in showing all products");
    }
})

// //Show Cart 
app.get("/product/cart", isLoggedIn, async (req, res)=>{
    let user = res.locals.currUser;
    let userAddress = 'select * from address where userId = ?';
    let getCartProductQuery = 'SELECT  p.productId,  p.productName, p.newPrice, p.productImage1, c.productQuantity FROM  Cart c JOIN  Products p ON c.productId = p.productId WHERE c.userId = ?;';
    try{
        let [address] = await connection.promise().query(userAddress, [user.userId]);
        let [cartProducts] = await connection.promise().query(getCartProductQuery, [user.userId]);
        let  products = cartProducts.map(product => {
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
            res.render('Product/cart.ejs', {products: products, price: price, tax: tax.toFixed(1), totalPrice: totalPrice.toFixed(1), totalCartProducts: productLength, userAddress: address[0]});
        } catch (err){
        res.send("There is something error in showing cart product");
    }
})

// //add new address
app.get("/product/address", isLoggedIn, (req, res)=>{
    let user= res.locals.currUser;
    let productNumberQuery = 'select * from Cart where userId = ?';
    try{
        if(user){
            connection.query(productNumberQuery, [user.userId], (err, result)=>{
                let totalCartProducts = result.length;

                if(err){
                    res.send(err);
                }
                else{
                    res.render('Product/addAddress.ejs', {totalCartProducts: totalCartProducts})
                }
            })
        }
        else{
            res.render('Product/addAddress.ejs', {totalCartProducts: 0})
        }
    } catch(err){
        res.send(err);
    } 
})

//Save address
app.post('/address/add',  (req, res)=>{
    let address = req.body.address;
    let user = res.locals.currUser;
    let saveAddress = 'insert into Address(userId, firstName, lastName, email, street, city, state, zipcode, country, phone ) values(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    try{
        connection.query(saveAddress, [user.userId, address.firstName, address.lastName, address.email, address.street, address.city, address.state, address.zipCode, address.country, address.phone], (err, result)=>{
            if(err){
                res.send(err);
            } else{
                res.send("Address save successfully");
            }
        })
    } catch(err){
        res.send(err);
    }
})

// // Details of Product
app.get("/product/:id", isLoggedIn, async (req, res)=>{
    let {id}= req.params;
    let user = res.locals.currUser;
    let findProductQuery = `select * from Products where productId = "${id.toString()}"`;
    let findRelatedProductsQuery = 'select * from Products where productCategory = ?';
    let productNumberQuery = 'select * from Cart where userId = ?';
    try{
        let productDetails =await connection.promise().query(findProductQuery);
        let myProductDetails = productDetails[0][0];
        let relatedProducts = await connection.promise().query(findRelatedProductsQuery, [myProductDetails.productCategory]);
        let myRelatedProducts = relatedProducts[0];
        if(user){
            let productNumber = await connection.promise().query(productNumberQuery, [user.userId]);
            let totalCartProducts = productNumber[0].length;
            if(productDetails && relatedProducts){
            res.render('Product/productDetails.ejs', {product: myProductDetails, relatedProducts: myRelatedProducts, totalCartProducts: totalCartProducts})
            }
            else{
            res.send("Product not found");
            }
        } else{
            if(productDetails && relatedProducts){
            res.render('Product/productDetails.ejs', {product: myProductDetails, relatedProducts: myRelatedProducts, totalCartProducts: 0})
            }
            else{
            res.send("Product not found");
            }
        }
        

    } catch(err){
        res.send(err);
    }
})

// //Show Seller Products
app.get("/seller", (req, res)=>{
    let allProducts = 'select * from Products';
    try{
      connection.query(allProducts, (err, result)=>{
        res.render('Seller/seller.ejs', {result})
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

// // Adding product to cart using add to cart button
app.post('/product/add/:id', isLoggedIn, (req, res)=>{
    let productId = req.params.id;
    let user = res.locals.currUser;
    let addToCartQuery = 'insert into Cart(userId,productId) values (?, ?)';
    try{
        connection.query(addToCartQuery, [user.userId, productId], (err, result)=>{
            if(err){
                res.send("There is something error in adding product to cart using add to cart button");
            } else{
                res.redirect(`/product/all`);
            }
        })
    } catch(err){
        res.send("There is something error in adding product to cart using add to cart button");
    }
})


// // Add to cart
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


// // Delete product from cart
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


// // Update Product Quantity in cart
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


app.post('/product/user/login', saveRedirectUrl, passport.authenticate('local', {
    failureRedirect: '/user/login',
    failureFlash: true
}), (req, res)=>{
    req.flash("success", "User Login Successful");
    let redirectUrl = res.locals.redirectUrl || "/product";
    res.redirect(redirectUrl);
})


// If any route doesn't match
// app.all("*", (req, res, next)=>{
//     next(new ExpressError(404, "Page Not found"));
// })

// // Error handling middleware
// app.use((err, req, res, next)=>{
//     let {statusCode=500, message="Something went wrong!"} = err;
//     res.send("Middleware error");
// })

app.listen(8080, ()=>{
    console.log("App is listening");
})



