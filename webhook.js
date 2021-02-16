const express = require('express')
const { WebhookClient } = require('dialogflow-fulfillment')
const app = express()
const fetch = require('node-fetch')
const base64 = require('base-64')

let username = "";
let password = "";
let token = "";

USE_LOCAL_ENDPOINT = false;
// set this flag to true if you want to use a local endpoint
// set this flag to false if you want to use the online endpoint
ENDPOINT_URL = ""
if (USE_LOCAL_ENDPOINT) {
  ENDPOINT_URL = "http://127.0.0.1:5000"
} else {
  ENDPOINT_URL = "https://mysqlcs639.cs.wisc.edu"
}

// getToken function: starter code
async function getToken() {
  let request = {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic ' + base64.encode(username + ':' + password)
    },
    redirect: 'follow'
  }

  const serverReturn = await fetch(ENDPOINT_URL + '/login', request)


  const serverResponse = await serverReturn.json()
  token = serverResponse.token

  return token;
}

app.get('/', (req, res) => res.send('online'))
app.post('/', express.json(), (req, res) => {
  const agent = new WebhookClient({ request: req, response: res })

  function welcome() {
    agent.add('Webhook works!')
    console.log(ENDPOINT_URL)
  }

  ////////// Login function //////////
  async function login() {

    username = agent.parameters.username;
    password = agent.parameters.password;


    await getToken()

    // if login fails
    if (token === "" || typeof token === 'undefined') {
      return agent.add("Sorry your password or username may be incorrect. Please try again!")
    }
    else {
      await clearMessages();
      // when login is successful
      addAgentMessage("Welcome to WiscShop, " + username + "!\n How may I assist you today?");
    }


  }

  ////////// Queries: getCategory function - to get list of categories //////////
  async function getCategory() {
    let request = {
      method: 'GET',
      redirect: 'follow'
    }

    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }

    const serverReturn = await fetch(ENDPOINT_URL + '/categories', request);

    if (!serverReturn.ok) {
      addAgentMessage("There was a problem accessing the list of categories. Please try again!");
      return;
    }

    const serverResponse = await serverReturn.json()

    let categories = serverResponse.categories;

    // comma separated; using 'and' to give the assistant a more of human personality 
    let message = "We offer products for " + categories.length + " total categories: \n"
    message += categories.splice(0, categories.length - 1).join(', ') + ", and " + categories[0] + "."
    addAgentMessage(message);


  }

  ////////// Queries: getTags function - to get list of tags for a particular category //////////
  async function getTags() {
    category = agent.parameters.category.toLowerCase();
    let request = {
      method: 'GET',
      redirect: 'follow'
    }

    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }

    const serverReturn = await fetch(ENDPOINT_URL + '/categories/' + category + '/tags', request);

    if (!serverReturn.ok) {
      addAgentMessage("We currently don't offer any items in the " + category + ".");
      await getCategory();
      return;
    }

    const serverResponse = await serverReturn.json()

    let tags = serverResponse.tags;

    // comma separated; using 'and' to give the assistant a more of human personality. Moreover, 
    // taking care of grammatically correct responses as follows
    if (tags.length > 2) {
      let message = "There are " + tags.length + " tags for " + category + ": \n"
      message += tags.splice(0, tags.length - 1).join(', ') + ", and " + tags[0] + "."
      addAgentMessage(message)

    } else if (tags.length == 1) {
      let message = "There is " + tags.length + " tag for " + category + ": \n"
      message += tags[0]
      addAgentMessage(message)

    }
    else {
      let message = "There are " + tags.length + " tags for " + category + ": \n"
      message += tags.join(" and ")
      addAgentMessage(message)

    }
  }

  ////////// Queries: getCart function - to get current information about the cart //////////
  async function getCart() {
    let request = {
      method: 'GET',
      headers: { 'x-access-token': token },
      redirect: 'follow'
    }

    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }


    const serverReturn = await fetch(ENDPOINT_URL + '/application/products/', request);

    if (!serverReturn.ok) {
      addAgentMessage("There was a problem accessing your cart. Please try again!");
      let x = await serverReturn.json();
      return;
    }

    const serverResponse = await serverReturn.json()

    let products = serverResponse.products;

    if (!products.length) {
      addAgentMessage("Your cart appears to be empty.");
      return;
    }

    message = "You currently have these " + products.length + " items in your cart: \n\n"

    let totalPrice = 0;
    let temp = []
    products.forEach((item, index) => {
      messagetemp = "\n" + item.count + " " + item.name + " for " + " ($" + item.price + ") each"
      temp.push(messagetemp)
      totalPrice += (item.price * item.count)
    })

    message += temp + "\n"

    message += "\nTotal price is $" + totalPrice + ".\n\n"
    addAgentMessage(message)

  }




  ////////// Queries: getProductList function - to get list of products in a particular category //////////
  async function getProductList() {
    category = agent.parameters.Categories.toLowerCase()

    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }

    await navigateTo("/" + category);
    addAgentMessage("These are the products we offer in " + category + ".");
  }

  ////////// Queries: getProducts function - to get all products in WiscShop //////////

  async function getProduct() {
    let request = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow'
    }

    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }

    const serverReturn = await fetch(ENDPOINT_URL + '/products', request);

    if (!serverReturn.ok) {
      throw "Error while accessing products"
    }

    const serverResponse = await serverReturn.json()


    return serverResponse;
  }


  ////////// Queries: getProductDetails function - to get info about a particular product //////////
  async function getProductDetails() {
    const productName = agent.parameters.productname

    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }


    let product = await getProductByName(productName);

    navigateTo("/" + product.category + "/products/" + product.id);


    agent.add("Here you go. Please find the details about " + product.name + "!");
    agent.add("Id: #" + product.id);
    agent.add("Category: " + product.category);
    agent.add("Description: " + product.description);
    agent.add("Price: $" + product.price);

  }

  ////////// getReviews function - helper for reviews function //////////

  async function getReviews(productID) {

    let request = {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow'
    }

    const serverReturn = await fetch(ENDPOINT_URL + '/products/' + productID + '/reviews', request)
    if (!serverReturn.ok) {
      console.log(serverReturn)
      throw "Error while accessing products"
    }
    const result = await serverReturn.json()

    return result;
  }

  ////////// Queries: showReview function - to get info about chosen product //////////

  async function showReview() {

    chosenProduct = agent.context.get('getproductdetails-followup').parameters.productname




    let allProducts = []
    allProducts = await getProduct()
    allProducts = allProducts.products



    let foundProduct = ""

    for (pro of allProducts) {
      if (chosenProduct === pro.name) {
        foundProduct = pro

      }

    }




    // console.log(foundProduct.id)
    let reviews = await getReviews(foundProduct.id)
    // console.log(reviews)
    reviews = reviews.reviews

    let message = 'No reviews or ratings for this product!'

    if (typeof reviews === 'undefined') {
      addAgentMessage(message)
    } else {
      let total = 0;
      let numReviews = 0;
      let reviewText = ""
      for (let r of reviews) {
        numReviews += 1
        total += r.stars
        reviewText += "Short Description: " + r.title + ". "
        reviewText += "Long description: " + r.text + "."
      }
      message = "There are  a total of " + numReviews + " reviews for this product with an average rating of " + total / numReviews + " stars."
      message += " Here they are!\n "
      message += reviewText.substring(0, reviewText.length - 1)
      addAgentMessage(message)
    }
  }



  ////////// Actions: filterByTags function - narrowing down search within category using filters //////////
  async function filterByTags() {
    tags = agent.parameters.tag;

    let request = {
      method: 'POST',
      headers: { 'x-access-token': token },
      redirect: 'follow'
    }

    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }
    // console.log(tags)


    const serverReturn = await fetch(ENDPOINT_URL + '/application/tags/' + tags, request)

    if (!serverReturn.ok) {
      // console.log(serverReturn)
      addAgentMessage("There was a problem while filtering products. Please try again!");
      return;
    }

    message = "Hera are the items with " + tags + " tags in the given category."
    addAgentMessage(message)

  }

  ////////// Actions: addToCart function - adding product(s) to cart //////////
  async function addToCart() {

    let productName = agent.parameters.productname

    let num = agent.parameters.num
    if (!num) {
      num = 1
    }

    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }

    let request = {
      method: 'POST',
      headers: { 'x-access-token': token },
      redirect: 'follow'
    }


    const product = await getProductByName(productName)
    // console.log(product)
    for (let i = 0; i < num; i++) {
      const serverReturn = await fetch(ENDPOINT_URL + '/application/products/' + product.id, request)
      if (!serverReturn.ok) {
        // console.log (serverReturn)
        addAgentMessage("There was a problem while adding to your cart. Please try again!");
        return;
      }
    }

    addAgentMessage(num + " " + product.name + " were successfully added to your cart.");
  }


  ////////// Actions: deleteFromCart function - deleting product from cart //////////
  async function deleteFromCart() {
    let productName = agent.parameters.productname

    let num = agent.parameters.num
    if (!num) {
      num = 1
    }

    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }

    let request = {
      method: 'DELETE',
      headers: { 'x-access-token': token },
      redirect: 'follow'
    }

    const product = await getProductByName(productName)

    for (let i = 0; i < num; i++) {
      const serverReturn = await fetch(ENDPOINT_URL + '/application/products/' + product.id, request)
      if (!serverReturn.ok) {
        // console.log (serverReturn)
        addAgentMessage("There was a problem while adding to your cart. Please try again!");
        return;
      }
    }
    addAgentMessage(product.name + " was successfully deleted from your cart!");
  }


  ////////// Actions: clearCart function - clears all items from cart //////////


  async function clearCart() {

    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }

    let request = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      },

    }

    const serverReturn = await fetch(ENDPOINT_URL + '/application/products/', request)

    if (!serverReturn.ok) {
      addAgentMessage("There was a problem while deleting the item from your cart. Please try again!");
      return;
    }

    const serverResponse = await serverReturn.json()

    addAgentMessage('All items from the cart has been removed. It is now empty')

  }

  ////////// Actions: reviewCart function - reviewing product(s) in cart prior to confirming purchase //////////
  async function reviewCart() {
    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }

    await navigateTo('/cart-review');
    addAgentMessage('Here are items in your cart. Would you like to place an order?')

  }

  ////////// Actions: confirmCart function - confirming product(s) for purchase //////////
  async function confirmCart() {
    const productContext = agent.context.get('cart-review')

    if (token === "" || typeof token === 'undefined') {
      addAgentMessage("Sorry I cannot perform that. Please login first!")
      return;
    }

    if (!productContext) {
      reviewCart();
      return;
    }

    await navigateTo('/cart-confirmed');
    addAgentMessage('Done, your order has been placed successfully. Thank you for shopping with us! \n Have a great Day!')

  }



  // GUI Messages Updation


  ////////// Messages: clearMessages function - clearing messages upon successful login //////////
  async function clearMessages() {
    let request = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      },
      redirect: 'follow'
    }
    const serverReturn = await fetch(ENDPOINT_URL + '/application/messages', request);

    if (!serverReturn.ok) {
      throw "Error while clearing a message."
    }
    return;
  }

  ////////// Messages: addMessage function - adding a message - User or Agent //////////
  async function addMessage(text, isUser) {
    let request = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      },
      body: JSON.stringify({
        isUser: isUser,
        text: text,
        date: new Date().toISOString()
      }),
      redirect: 'follow'
    }
    const serverReturn = await fetch(ENDPOINT_URL + '/application/messages', request);

    if (!serverReturn.ok) {
      console.log(serverReturn)
      throw "Error while adding a message."
    }

    return;
  }

  ////////// Messages: addAgentMessage function - adding Agent specific messages - Dialogflow or GUI //////////
  async function addAgentMessage(text) {
    agent.add(text);
    await addMessage(text, 0);

    return;
  }

  ////////// Navigation: navigateTo function - navigating to a specific page - GUI //////////
  async function navigateTo(page) {
    let request = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-access-token': token
      },
      body: JSON.stringify({
        page: '/' + username + page,
        dialogflowUpdated: true,
        back: false
      }),
      redirect: 'follow'
    }
    const serverReturn = await fetch(ENDPOINT_URL + '/application', request);

    if (!serverReturn.ok) {
      throw "Error while navigating user."
    }
    const serverResponse = await serverReturn.json()

    return serverResponse;
  }

  ////////// Navigation: navigateToCommand function - navigating to a specific page user commands to - GUI //////////
  async function navigateToCommand() {
    const page = agent.parameters.page

    if (page === "home") {
      await navigateTo('/')
    } else if (page === "cart") {
      if (token === "" || typeof token === 'undefined') {
        addAgentMessage("Sorry I cannot perform that. Please login first!")
        return;
      }
      await navigateTo('/cart')
    }

    addAgentMessage('Okay!')
  }

  ////////// Design and Personality: getProductByName function - to get products by name instead of ID //////////
  async function getProductByName(productName) {
    let request = {
      method: 'GET',
      redirect: 'follow'
    }

    const serverReturn = await fetch(ENDPOINT_URL + '/products', request);

    if (!serverReturn.ok) {
      throw "Error while accessing products"
    }

    const serverResponse = await serverReturn.json()
    const productsList = serverResponse.products;

    item = productsList.find(({ name }) => name === productName);

    return item

  }



  let intentMap = new Map()
  intentMap.set('Default Welcome Intent', welcome) //starter code
  intentMap.set('Login', login) // query
  intentMap.set('GetCategory', getCategory) // query
  intentMap.set('GetTags', getTags) // query
  intentMap.set('GetCart', getCart) // query
  intentMap.set('GetProductList', getProductList) // query
  intentMap.set('GetProduct', getProduct) // query
  intentMap.set('GetProductDetails', getProductDetails) // query
  intentMap.set('ShowReview', showReview) //query
  intentMap.set('FilterByTags', filterByTags) // action
  intentMap.set('AddCart', addToCart) // action
  intentMap.set('DeleteCart', deleteFromCart) // action
  intentMap.set('ClearCart', clearCart) // action
  intentMap.set('ReviewCart', reviewCart) // action
  intentMap.set('ConfirmCart', confirmCart) // action
  intentMap.set('NavigateToCommand', navigateToCommand) // navigation
  addMessage(agent.query, 1); // user messages in GUI
  agent.handleRequest(intentMap)
})

app.listen(process.env.PORT || 8080)
