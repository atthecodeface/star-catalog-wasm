use std::cell::{Ref, RefCell, RefMut};
use std::rc::Rc;

//a Rrc
//tp Rrc
#[derive(Debug)]
pub struct Rrc<T>(Rc<RefCell<T>>);
impl<T> From<T> for Rrc<T> {
    fn from(data: T) -> Self {
        Self(Rc::new(RefCell::new(data)))
    }
}
impl<T> Clone for Rrc<T> {
    fn clone(&self) -> Self {
        Self(self.0.clone())
    }
}

impl<T> Rrc<T> {
    pub fn borrow(&self) -> Ref<T> {
        self.0.borrow()
    }
    pub fn borrow_mut(&self) -> RefMut<T> {
        self.0.borrow_mut()
    }
}
impl<T> std::default::Default for Rrc<T>
where
    T: Default,
{
    fn default() -> Self {
        T::default().into()
    }
}
impl<T> std::ops::Deref for Rrc<T> {
    type Target = RefCell<T>;
    fn deref(&self) -> &RefCell<T> {
        &self.0
    }
}
