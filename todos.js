const express = require("express");
const morgan = require("morgan");
const flash = require("express-flash");
const session = require("express-session");
const { body, validationResult } = require("express-validator");
const TodoList = require("./lib/todolist")
const { sortTodoLists, sortTodos } = require("./lib/sort");


const app = express();
const host = "localhost";
const port = 3000;

let todoLists = require("./lib/seed-data");
const Todo = require("./lib/todo.js");

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
app.use((req, res, next) => {
  res.locals.flash = req.session.flash;
  delete req.session.flash;
  next();
})

const loadTodoList = todoListId => {
  return todoLists.find(list => list.id === todoListId);
}



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
    req.flash("error", "Title must be unique.");
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

app.post("/lists", (req, res) => {
  [
    body("todoListTitle")
      .trim()
      .isLength({min: 1})
      .withMessage("Title is Required")
      .bail()
      .isLength({max: 100})
      .withMessage("Title cannot exceed 100 characters")
      .custom(title => {
        let duplicate = todoLists.find(list => list.title = title);
        return duplicate === undefined;
      })
      .withMessage("That todo alreadt exists")
  ],
  (req, res) => {
    let errors = validationResult(req);
    if (!errors.isEmpty()) {
      errors.array().forEach(err => req.flash("error", err.msg));
      res.render("new-list", {
        flash: req.flash(),
        todoListTitle: req.body.todoListTitle,
      });
    } else {
      todoLists.push(new TodoList(req.body.todoListTitle));
      req.flash("success", "New Todo Created!")
      res.redirect("/lists")
    }
  }
})

app.get("/lists/:todoListId", (req, res, next) => {
  let todoListId = req.params.todoListId;
  let selectedTodoList = loadTodoList(+todoListId);

  if (selectedTodoList === undefined) {
    next(new Error("Not found."));
  } else {
    res.render("list", {
      todoList: selectedTodoList,
      todos: sortTodos(selectedTodoList),
    })
  }
});

app.use((err, req, res, _next) => {
  console.log(err);
  res.status(404).send(err.message);
});

app.listen(port, host, () => {
  console.log("listening on port " + port + " of " + host + "...");
});


