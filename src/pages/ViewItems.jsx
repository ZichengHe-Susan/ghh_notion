import React, { useEffect, useState } from 'react';
import { db,storage } from '../firebase'; 
import { getDocs, collection, deleteDoc, doc, updateDoc,arrayUnion } from 'firebase/firestore';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ref, deleteObject } from 'firebase/storage';


import '../css/ViewItems.css';

const ViewItems = () => {
  const [itemsList, setItemsList] = useState([]);

  const [cart, setCart] = useState([]); 

  const itemsCollectionRef = collection(db, "items");

  useEffect(() => {
    const getItemsList = async () => {
      try {
        const data = await getDocs(itemsCollectionRef);
          const filteredData = data.docs
          .map((doc) => ({ ...doc.data(), id: doc.id }))
          .filter((item) => item.isAvailable);  
        
        setItemsList(filteredData); 
      } catch (err) {
        console.error("Error fetching items: ", err);
      }
    };
  
    getItemsList();
  }, []);  
  

  const addToCart = async (item) => {
    const userDocRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userDocRef, {
        items: arrayUnion(item.id),
    });
    alert(`${item.name} has been added to your cart!`);
  };

  const { currentUser, userData } = useAuth();

  const deleteItem = async (itemId, imageURL) => {
    const itemDocRef = doc(db, "items", itemId);
  
    // Create a reference to the file to delete
    const imageRef = ref(storage, imageURL);
  
    try {
      // Delete the image from storage
      if (imageURL) {
        const imageRef = ref(storage, imageURL);
        await deleteObject(imageRef);
        console.log("Image deleted successfully");
      }
  
      // Delete the item from Firestore
      await deleteDoc(itemDocRef);
      setItemsList(itemsList.filter(item => item.id !== itemId)); // Remove the item from the local state
      alert("Item deleted successfully.");
    } catch (err) {
      console.error("Error deleting item: ", err);
    }
  };

  return (
    <div>
      <div className="container">
        <h2 className="shopHeader">Click on the items to view item details </h2>
        
      </div>
        
      <div className="container">
        {itemsList.map((item) => (
          <div key={item.id} className="itemBox">
            <div className="textContainer">
              <Link to={`/item/${item.id}`} className="itemTitle">
                <h1 className="itemNameShop">{item.name}</h1>
              </Link> 
              {/* <h1 className="itemTitle">{item.name}</h1> */}
              <p className="itemPrice">Price: ${item.price}</p>
              <div className="button-group">
              {currentUser && currentUser.uid != item.seller && 
                (<button
                  className="addToCartButton" 
                  onClick={() => addToCart(item)} 
                  >Add to Cart</button>)}
                  {currentUser && currentUser.uid === item.seller && ( 
                  <button className="deleteButton" onClick={() => deleteItem(item.id, item.imageURL || null)}>
                    Delete Item
                </button>
                )}
              </div>
            </div>
            {item.imageURL ? (
              <div className="imageContainer">
                <img src={item.imageURL} alt={item.name} className="itemImage" />
              </div>
            ) : (
              <p>No image available</p>
            )}          
          </div>
        ))}
      </div>
    </div>
    
  );
};

export default ViewItems;