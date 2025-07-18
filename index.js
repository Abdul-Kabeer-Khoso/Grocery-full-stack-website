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
        throw new ExpressError(500, err);
    }
});

//Orders
app.get("/orders", isLoggedIn, async (req, res)=>{
    let user = res.locals.currUser;
    let productNumberQuery = 'select * from Cart where userId = ?';
    
    let orderIdsQuery = 'select distinct orderId from Orders where userId = ?';
    let orderQuery = 'select * from Orders where orderId IN (?)'
    let orderProductsQuery = 'select * from Products where productId = ?';

    let allOrderProducts = [];
    try{
            let productNumber = await connection.promise().query(productNumberQuery, [user.userId]);
            let totalCartProducts = productNumber[0].length;

            let orderIds = await connection.promise().query(orderIdsQuery, user.userId);
            let newOrderIds = orderIds[0].map(val => val.orderId);

            let products = await connection.promise().query(orderQuery, [newOrderIds]);
            let orders = products[0];


            let orderId;

            if(products[0][0]){
                orderId = products[0][0].orderId;
            }

            if(orders[0]){
                for(order of orders){
                let productId = order.productId;
                let orderProduct = await connection.promise().query(orderProductsQuery, [productId]);
                allOrderProducts.push(...orderProduct[0]);
            }
            }

            let ordersQuantity = orders.map(val=>{
                return val.productQuantity;
            })

            let productsPrice = allOrderProducts.map(val=>{
                return val.newPrice;
            })

            let productTotalPrice=[];

            for(let i=0; i<ordersQuantity.length; i++){
                productTotalPrice[i]=ordersQuantity[i]*productsPrice[i];
            }

            let ordersTotalPrice = 0;

            for(let i=0; i<productTotalPrice.length; i++){
                ordersTotalPrice+=productTotalPrice[i];
            }

            res.render("Product/order.ejs", {totalCartProducts: totalCartProducts, orders: orders, orderId: newOrderIds, products: allOrderProducts, orderTotalPrice: ordersTotalPrice});   
    } catch(err){
    throw new ExpressError(500, err);
    }
})

// Place order
app.post("/placeOrder", isLoggedIn, async (req, res)=>{
    let productIds = req.body.productId;
    const user = res.locals.currUser;
    const orderId = uuidv4();
    const paymentMethod = req.body.paymentMethod;
    const currentDate = new Date().toISOString().split('T')[0];
    let deleteCartProducts = 'delete from Cart where productId IN (?)';
    let cartQuery = 'select productId ,productQuantity from Cart where userId = ? AND productId IN (?)';
    let addOrderQuery = 'insert into Orders(orderId ,userId, productId, productQuantity, orderDate, paymentMethod) Values ?';
    try{
        let [cartProducts] = await connection.promise().query(cartQuery, [user.userId, productIds])
        const values = cartProducts.map(val=>[
            orderId,
            user.userId,
            val.productId,
            val.productQuantity,
            currentDate,
            paymentMethod,
        ])

        let [orders] = await connection.promise().query(addOrderQuery, [values]);
        await connection.promise().query(deleteCartProducts, [productIds]);
        res.redirect('/orders');

    } catch(err){
        throw new ExpressError(500, err);
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
        throw new ExpressError(500, err);
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
        throw new ExpressError(500, err);
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
        throw new ExpressError(500, err);
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
        throw new ExpressError(500, err);
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
       throw new ExpressError(500, err);
    }
})

//Seller login
app.get("/seller/login", async (req, res)=>{
    let user = res.locals.currUser;
    let productNumberQuery = 'select * from Cart where userId = ?';
    let totalCartProducts;
     if(user){
            let productNumber = await connection.promise().query(productNumberQuery, [user.userId]);
            totalCartProducts = productNumber[0].length;
     }
     else{
        totalCartProducts = 0;
     }
     
    res.render("./Seller/sellerLogin.ejs", {totalCartProducts});
})

//Seller authentication
app.post("/seller/admin/login", (req, res)=>{
    let {email, password} = req.body;
    if(email=="admin@gmail.com" && password=="admin"){
        req.flash("success", "Admin login successfully");
        res.redirect("/seller");
    }
    else{
        req.flash("error", "Email or Password Incorrect");
        res.redirect("/seller/login");
    }
})

// //Show Seller Products
app.get("/seller", async (req, res)=>{
    let allProducts = 'select * from Products';
    let orderIdQuery = 'select distinct orderId from Orders';
    let ordersQuery = `
       SELECT 
        o.*, 
        p.productName,
        a.firstName, a.lastName, a.street, a.city, a.state, a.zipCode, a.country
        FROM Orders o
        JOIN Products p ON o.productId = p.productId
        JOIN Address a ON o.userId = a.userId
        WHERE o.orderId IN (?)`;
    let totalValueQuery = `
        SELECT 
        orderId,
        SUM( o.productQuantity * p.newPrice) AS totalOrderValue
        FROM orders o
        JOIN products p ON o.productId = p.productId
        GROUP BY orderId`;

    try{
      let orderId = await connection.promise().query(orderIdQuery);
      let newOrderId = orderId[0].map(val=>val.orderId);
      let ordersDetails = await connection.promise().query(ordersQuery, [newOrderId]); 
      let orders = ordersDetails[0];
      let [totalPrice] = await connection.promise().query(totalValueQuery);
      let allproducts = await connection.promise().query(allProducts);


 // Step 3: Group orders by orderId
        const groupedOrders = {};
        orders.forEach(order => {
            if (!groupedOrders[order.orderId]) {
                groupedOrders[order.orderId] = {
                    orderId: order.orderId,
                    user: `${order.firstName} ${order.lastName}`,
                    address: `${order.street}, ${order.city}, ${order.state}, ${order.zipCode}, ${order.country}`,
                    paymentMethod: order.paymentMethod,
                    orderDate: order.orderDate,
                    products: [],
                    totalOrderValue: 0
                };
            }

            groupedOrders[order.orderId].products.push({
                name: order.productName,
                quantity: order.productQuantity,
                price: order.price,
                image: order.productImage,
            });
        });


        
    
    res.render('Seller/seller.ejs', {result: allproducts[0], orders: Object.values(groupedOrders), totalPrice: totalPrice})
    }catch(err){
        throw new ExpressError(500, err);
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
        throw new ExpressError(500, err);
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
        throw new ExpressError(500, err);
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
        throw new ExpressError(500, err);
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
        throw new ExpressError(500, err);
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
        throw new ExpressError(500, err);
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
        throw new ExpressError(500, err);
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
// app.all('*', (req, res, next)=>{
//     next(new ExpressError(404, "Page Not found"));
// })

// Error handling middleware
app.use((err, req, res, next)=>{
    let {statusCode=500, message="Something went wrong!"} = err;
    res.render('error.ejs', {errorMessage: message});
})

app.listen(8080, ()=>{
    console.log("App is listening");
})



