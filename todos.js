const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const TodoList = require("./lib/todolist.js")


const app = express();
const host = "localhost";
const port = 3000;

let todoLists = require("./lib/seed-data");

app.set("views", "./views");
app.set("view engine", "pug");

app.use(morgan("common"));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: false }));
app.use(session({
  name: "launch-school-todos-session-id",
  resave: false,
  saveUninitialized: true,
  secret: "this is not very secure",
}));

app.use(flash());


const sortTodoLists = lists => {
  return lists.slice().sort((todoListA, todoListB) => {
    let isDoneA = todoListA.isDone();
    let isDoneB = todoListB.isDone();

    if (!isDoneA && isDoneB) {
      return -1;
    } else if (isDoneA && !isDoneB) {
      return 1;
    } else {
      let titleA = todoListA.title.toLowerCase();
      let titleB = todoListB.title.toLowerCase();

      if (titleA < titleB) {
        return -1;
      } else if (titleA > titleB) {
        return 1;
      } else {
        return 0;
      }
    }
  });
};

app.get("/", (req, res) => {
  res.redirect("/lists");
})

app.get("/lists", (req, res) => {
  res.render("lists", {
    todoLists: sortTodoLists(todoLists),
  });
});

app.get("/lists/new", (req, res) => {
  res.render("new-list");
});

app.post("/lists", (req, res) => {
  let title = req.body.todoListTitle.trim();

  if (title.length === 0) {
    req.flash("error", "A title was not provided.")
    res.render("new-list", {
      flash: req.flash(),
    })
  } else if (title.length > 100) {
    req.flash("error", "Title must not exceed 100 characters.");
    res.render("new-list", {
      flash: req.flash(),
      todoListTitle: req.body.todoListTitle,
    })
  } else if (todoLists.some(todoList => todoList.title === title)) {
    req.flash("error", "Title must be unique,");
    res.render("new-list", {
      flash: req.flash(),
      todoListTitle: req.body.todoListTitle,
    })
  } else {
    todoLists.push(new TodoList(title));
    req.flash("success", "New todo list created!");
    res.redirect("/lists");
  }
})

app.listen(port, host, () => {
  console.log("listening on port " + port + " of " + host + "...");
});

